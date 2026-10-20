/**
 * Incremental Server-Sent Events parser. Works for both OpenAI and Gemini
 * streams; vendor-specific JSON decoding happens in each adapter.
 */
export async function* parseSseData(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const drain = function* (flush: boolean): Generator<string> {
    let normalized = buffer.replaceAll('\r\n', '\n');
    let index = normalized.indexOf('\n\n');
    while (index !== -1) {
      const block = normalized.slice(0, index);
      normalized = normalized.slice(index + 2);
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data.length > 0) yield data;
      index = normalized.indexOf('\n\n');
    }
    if (flush) {
      const data = normalized
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      normalized = '';
      if (data.length > 0) yield data;
    }
    buffer = normalized;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      yield* drain(false);
    }
    buffer += decoder.decode();
    yield* drain(true);
  } finally {
    reader.releaseLock();
  }
}

export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Split a potentially multi-line `data:` payload that contains JSON. */
export function parseJson<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
