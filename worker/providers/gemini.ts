import type { Env } from '../types';
import { ProviderError, providerErrorForStatus, resolveBaseUrl, type AIProvider, type ProviderChatRequest } from './types';
import { parseJson, parseSseData } from './sse';

interface GeminiChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';

  isAvailable(env: Env): boolean {
    return Boolean(env.GEMINI_API_KEY);
  }

  async *streamChat(env: Env, request: ProviderChatRequest): AsyncGenerator<string, void, unknown> {
    if (!env.GEMINI_API_KEY) {
      throw new ProviderError(503, 'PROVIDER_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่า Gemini API Key');
    }
    const base = resolveBaseUrl(env.GEMINI_BASE_URL, 'https://generativelanguage.googleapis.com/v1beta');
    const endpoint = new URL(
      `models/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse`,
      base.href.endsWith('/') ? base.href : `${base.href}/`,
    );
    endpoint.searchParams.set('key', env.GEMINI_API_KEY);

    const systemParts = request.messages.filter((message) => message.role === 'system');
    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemParts.length > 0
          ? { systemInstruction: { parts: [{ text: systemParts.map((m) => m.content).join('\n\n') }] } }
          : {}),
        generationConfig: { temperature: 0.7 },
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      await response.text().catch(() => '');
      throw providerErrorForStatus(response.status);
    }
    if (!response.body) {
      throw new ProviderError(502, 'PROVIDER_BAD_RESPONSE', 'ผู้ให้บริการไม่ได้ส่งข้อมูลกลับมา');
    }

    for await (const data of parseSseData(response.body)) {
      const chunk = parseJson<GeminiChunk>(data);
      if (!chunk) continue;
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.text && part.thought !== true) yield part.text;
      }
      if (chunk.candidates?.[0]?.finishReason) return;
    }
  }
}
