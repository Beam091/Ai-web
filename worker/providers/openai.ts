import type { Env } from '../types';
import { ProviderError, providerErrorForStatus, resolveBaseUrl, type AIProvider, type ProviderChatRequest } from './types';
import { parseJson, parseSseData } from './sse';

interface OpenAIChunk {
  choices?: Array<{
    delta?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';

  isAvailable(env: Env): boolean {
    return Boolean(env.OPENAI_API_KEY);
  }

  async *streamChat(env: Env, request: ProviderChatRequest): AsyncGenerator<string, void, unknown> {
    if (!env.OPENAI_API_KEY) {
      throw new ProviderError(503, 'PROVIDER_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่า OpenAI API Key');
    }
    const base = resolveBaseUrl(env.OPENAI_BASE_URL, 'https://api.openai.com/v1');
    const endpoint = new URL('chat/completions', base.href.endsWith('/') ? base.href : `${base.href}/`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
        stream: true,
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      // Drain the body so the connection is released, but never forward it.
      await response.text().catch(() => '');
      throw providerErrorForStatus(response.status);
    }
    if (!response.body) {
      throw new ProviderError(502, 'PROVIDER_BAD_RESPONSE', 'ผู้ให้บริการไม่ได้ส่งข้อมูลกลับมา');
    }

    for await (const data of parseSseData(response.body)) {
      if (data === '[DONE]') return;
      const chunk = parseJson<OpenAIChunk>(data);
      if (!chunk || chunk.error) continue;
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) yield text;
      if (chunk.choices?.[0]?.finish_reason) return;
    }
  }
}
