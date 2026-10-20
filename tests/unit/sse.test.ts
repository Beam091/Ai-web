import { describe, expect, it } from 'vitest';
import { parseSseData } from '../../worker/providers/sse';

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const items: string[] = [];
  for await (const data of parseSseData(stream)) items.push(data);
  return items;
}

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('parseSseData', () => {
  it('reassembles events split across network chunks', async () => {
    const items = await collect(
      streamFromChunks(['data: {"text":"hel', 'lo"}\n\ndata: {"text":" world"}\n\n']),
    );
    expect(items).toEqual(['{"text":"hello"}', '{"text":" world"}']);
  });

  it('handles CRLF and multi-line data fields', async () => {
    const items = await collect(streamFromChunks(['event: delta\r\ndata: line1\r\ndata: line2\r\n\r\n']));
    expect(items).toEqual(['line1\nline2']);
  });

  it('flushes a final event without a trailing blank line', async () => {
    const items = await collect(streamFromChunks(['data: [DONE]']));
    expect(items).toEqual(['[DONE]']);
  });

  it('ignores comment-only blocks', async () => {
    const items = await collect(streamFromChunks([': keep-alive\n\n', 'data: x\n\n']));
    expect(items).toEqual(['x']);
  });
});
