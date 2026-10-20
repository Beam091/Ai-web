import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../../worker/providers/openai';
import { GeminiProvider } from '../../worker/providers/gemini';
import { ProviderError } from '../../worker/providers/types';
import type { Env } from '../../worker/types';

const env = {
  OPENAI_API_KEY: 'sk-test',
  GEMINI_API_KEY: 'gm-test',
} as unknown as Env;

const signal = new AbortController().signal;

function sseResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

async function collect(provider: OpenAIProvider | GeminiProvider, model: string): Promise<string> {
  let text = '';
  for await (const chunk of provider.streamChat(env, {
    model,
    signal,
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'สวัสดี' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'user', content: 'เล่าต่อ' },
    ],
  })) {
    text += chunk;
  }
  return text;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAIProvider', () => {
  it('normalizes streaming chunks and sends an allowlisted request', async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse(
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":" world"}}]}\n\n' +
          'data: [DONE]\n\n',
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIProvider();
    await expect(collect(provider, 'gpt-4.1-mini')).resolves.toBe('Hello world');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(String(init.body)) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string }>;
    };
    expect(body.model).toBe('gpt-4.1-mini');
    expect(body.stream).toBe(true);
    expect(body.messages.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });

  it('maps 429 to a safe provider error without leaking the body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('secret upstream detail', { status: 429 })),
    );
    const provider = new OpenAIProvider();
    await expect(collect(provider, 'gpt-4.1-mini')).rejects.toMatchObject({
      code: 'PROVIDER_RATE_LIMITED',
      status: 429,
    });
  });

  it('refuses to run without a key', async () => {
    const provider = new OpenAIProvider();
    const noKeyEnv = {} as Env;
    const iterator = provider.streamChat(noKeyEnv, {
      model: 'gpt-4.1-mini',
      signal,
      messages: [{ role: 'user', content: 'hi' }],
    });
    await expect(iterator.next()).rejects.toBeInstanceOf(ProviderError);
  });
});

describe('GeminiProvider', () => {
  it('maps roles and system instructions to Gemini payloads', async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse(
        'data: {"candidates":[{"content":{"parts":[{"text":"สวัสดี"}]}}]}\n\n' +
          'data: {"candidates":[{"content":{"parts":[{"text":"ครับ"}]},"finishReason":"STOP"}]}\n\n',
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiProvider();
    await expect(collect(provider, 'gemini-2.5-flash')).resolves.toBe('สวัสดีครับ');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain('/models/gemini-2.5-flash:streamGenerateContent');
    expect(String(url)).toContain('alt=sse');
    const body = JSON.parse(String(init.body)) as {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      systemInstruction: { parts: Array<{ text: string }> };
    };
    expect(body.contents.map((item) => item.role)).toEqual(['user', 'model', 'user']);
    expect(body.systemInstruction.parts[0].text).toContain('You are helpful');
  });

  it('ignores thought parts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse(
          'data: {"candidates":[{"content":{"parts":[{"text":"thinking","thought":true},{"text":"answer"}]}}]}\n\n',
        ),
      ),
    );
    const provider = new GeminiProvider();
    await expect(collect(provider, 'gemini-2.5-pro')).resolves.toBe('answer');
  });
});
