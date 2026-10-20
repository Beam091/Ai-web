import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { errors } from '../lib/errors';
import { newId } from '../lib/crypto';
import { checkRateLimit, intEnv } from '../lib/rate-limit';
import { createOutputBudget } from '../lib/output-budget';
import { chatSchema, titleFromContent, zodMessage } from '../lib/validation';
import {
  appendMessage,
  createConversation,
  getConversation,
  loadContextMessages,
  touchConversation,
  type ConversationRow,
  type Message,
} from '../db/queries';
import { requireAuth } from '../middleware/auth';
import { resolveModel } from '../providers/catalog';
import { getProvider } from '../providers/registry';
import { ProviderError, type ProviderMessage } from '../providers/types';
import { sseEvent } from '../providers/sse';

export const chatRoutes = new Hono<AppEnv>();

chatRoutes.use('*', requireAuth);

const SYSTEM_PROMPT =
  'You are a helpful, accurate assistant. Answer in the language the user writes in. ' +
  'Use Markdown for structure and fenced code blocks for code.';

function safeProviderError(error: unknown): { code: string; message: string } {
  if (error instanceof ProviderError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'เชื่อมต่อผู้ให้บริการ AI ไม่สำเร็จ กรุณาลองใหม่ภายหลัง',
  };
}

chatRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) throw errors.badRequest(zodMessage(parsed.error), 'VALIDATION_ERROR');
  const input = parsed.data;

  const userId = c.get('user').id;

  // Allowlist check before touching rate limits or the database.
  if (!resolveModel(c.env, input.provider, input.model)) {
    throw errors.badRequest('provider หรือโมเดลนี้ไม่อยู่ในรายการที่อนุญาต', 'MODEL_NOT_ALLOWED');
  }
  const provider = getProvider(input.provider);
  if (!provider) throw errors.badRequest('ไม่พบผู้ให้บริการนี้', 'PROVIDER_NOT_FOUND');

  const windowMs = intEnv(c.env.CHAT_RATE_WINDOW_MINUTES, 5, 1, 1440) * 60_000;
  const limit = intEnv(c.env.CHAT_RATE_LIMIT, 20, 1, 500);
  const rate = await checkRateLimit(c.env, `chat:${userId}`, limit, windowMs);
  if (!rate.allowed) throw errors.rateLimited();

  let conversation: ConversationRow;
  if (input.conversationId) {
    const existing = await getConversation(c.env, userId, input.conversationId);
    if (!existing) throw errors.notFound('ไม่พบบทสนทนานี้');
    conversation = existing;
  } else {
    conversation = await createConversation(c.env, {
      id: newId(),
      userId,
      title: titleFromContent(input.content),
      provider: input.provider,
      model: input.model,
    });
  }

  const userMessageId = newId();
  await appendMessage(c.env, {
    id: userMessageId,
    conversationId: conversation.id,
    role: 'user',
    content: input.content,
  });

  const history: Message[] = await loadContextMessages(c.env, conversation.id);
  const providerMessages: ProviderMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((message) => ({ role: message.role, content: message.content })),
  ];

  const assistantMessageId = newId();
  const abortController = new AbortController();
  const requestSignal = c.req.raw.signal;
  const timeoutMs = intEnv(c.env.AI_TIMEOUT_SECONDS, 90, 1, 300) * 1000;
  const maxOutputChars = intEnv(c.env.AI_MAX_OUTPUT_CHARS, 32_000, 500, 200_000);
  const outputBudget = createOutputBudget(maxOutputChars);
  let streamClosed = false;
  let content = '';
  let persisted = false;
  let stopReason: 'client' | 'timeout' | 'limit' | null = null;

  const stop = () => {
    if (!abortController.signal.aborted) abortController.abort();
  };

  const persistAssistant = async (status: 'complete' | 'error' | 'aborted') => {
    if (persisted) return;
    persisted = true;
    if (content.trim().length > 0) {
      await appendMessage(c.env, {
        id: assistantMessageId,
        conversationId: conversation.id,
        role: 'assistant',
        content,
        provider: input.provider,
        model: input.model,
        status,
      });
    }
    await touchConversation(c.env, conversation.id, input.provider, input.model);
  };

  /**
   * Client disconnects cancel the request context. waitUntil keeps the partial
   * message write alive for a short while after the response stream is gone.
   */
  const persistAfterDisconnect = (status: 'aborted') => {
    const task = persistAssistant(status).catch(() => undefined);
    try {
      c.executionCtx.waitUntil(task);
    } catch {
      void task;
    }
  };

  const handleRequestAbort = () => {
    if (stopReason !== null) return;
    stopReason = 'client';
    stop();
    persistAfterDisconnect('aborted');
  };

  requestSignal.addEventListener('abort', handleRequestAbort);

  const timeoutId = setTimeout(() => {
    if (stopReason === null) {
      stopReason = 'timeout';
      stop();
    }
  }, timeoutMs);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          streamClosed = true;
        }
      };

      send('meta', {
        conversationId: conversation.id,
        userMessageId,
        assistantMessageId,
        provider: input.provider,
        model: input.model,
        title: conversation.title,
      });

      try {
        for await (const delta of provider.streamChat(c.env, {
          model: input.model,
          messages: providerMessages,
          signal: abortController.signal,
        })) {
          if (streamClosed) break;

          // Enforce the character budget before sending, so the last delta is
          // trimmed instead of exceeding the configured limit.
          const chunk = outputBudget.append(delta);
          if (chunk.text) {
            content += chunk.text;
            send('delta', { text: chunk.text });
          }
          if (chunk.reachedLimit) {
            stopReason = 'limit';
            stop();
            break;
          }
        }

        if (stopReason === 'timeout') {
          throw new ProviderError(504, 'PROVIDER_TIMEOUT', 'ผู้ให้บริการใช้เวลานานเกินกำหนด กรุณาลองใหม่');
        }
        if (stopReason === 'limit') {
          throw new ProviderError(502, 'RESPONSE_LIMIT_REACHED', 'คำตอบยาวเกินกำหนด ระบบจึงหยุดไว้ที่ขีดจำกัด');
        }
        if (!streamClosed && content.trim().length === 0) {
          throw new ProviderError(502, 'PROVIDER_EMPTY_RESPONSE', 'ผู้ให้บริการไม่ได้ส่งคำตอบกลับมา');
        }

        await persistAssistant('complete');
        send('done', {
          assistantMessageId,
          conversationId: conversation.id,
          characters: content.length,
        });
      } catch (error) {
        if (stopReason === 'client') {
          await persistAssistant('aborted');
        } else {
          await persistAssistant('error');
          const safe =
            stopReason === 'timeout'
              ? { code: 'PROVIDER_TIMEOUT', message: 'ผู้ให้บริการใช้เวลานานเกินกำหนด กรุณาลองใหม่' }
              : stopReason === 'limit'
                ? { code: 'RESPONSE_LIMIT_REACHED', message: 'คำตอบยาวเกินกำหนด ระบบจึงหยุดไว้ที่ขีดจำกัด' }
                : safeProviderError(error);
          send('error', safe);
        }
      } finally {
        clearTimeout(timeoutId);
        requestSignal.removeEventListener('abort', handleRequestAbort);
        if (!streamClosed) {
          streamClosed = true;
          try {
            controller.close();
          } catch {
            // Stream already closed by the client.
          }
        }
      }
    },
    cancel() {
      streamClosed = true;
      if (stopReason !== null) return;
      stopReason = 'client';
      stop();
      persistAfterDisconnect('aborted');
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      'x-content-type-options': 'nosniff',
    },
  });
});
