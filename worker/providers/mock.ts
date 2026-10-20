import type { Env } from '../types';
import type { AIProvider, ProviderChatRequest } from './types';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Deterministic provider used for local UI work and automated tests. It never
 * leaves the Worker and never needs credentials. UI labels it clearly as a demo
 * so users cannot mistake it for a real model.
 */
export class MockProvider implements AIProvider {
  readonly id = 'mock';

  isAvailable(_env: Env): boolean {
    return true;
  }

  async *streamChat(env: Env, request: ProviderChatRequest): AsyncGenerator<string, void, unknown> {
    const configuredDelay = Number.parseInt(env.MOCK_DELAY_MS ?? '', 10);
    const delay = Number.isFinite(configuredDelay) ? Math.min(500, Math.max(0, configuredDelay)) : 8;
    const lastUser = [...request.messages].reverse().find((message) => message.role === 'user');
    const quoted = (lastUser?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);

    const reply = [
      '**Mock Provider** — นี่คือคำตอบจำลอง ไม่ได้เรียกโมเดล AI จริง\n\n',
      'ระบบได้รับการเชื่อมต่อครบถ้วนแล้ว: ',
      quoted ? `คุณพิมพ์ว่า “${quoted}”\n\n` : '\n\n',
      '### สิ่งที่ทดสอบได้ด้วยโหมดนี้\n',
      '- การส่งข้อความและ Streaming แบบทีละส่วน\n',
      '- การบันทึกประวัติลง Cloudflare D1\n',
      '- การแสดง Markdown, ตาราง และ Code Block\n',
      '- ปุ่ม Stop, Copy และการสลับบทสนทนา\n\n',
      '```ts\n',
      "const answer = await chat({ provider: 'openai', model: 'gpt-4.1-mini' });\n",
      'console.log(answer);\n',
      '```\n\n',
      '> ตั้งค่า `OPENAI_API_KEY` หรือ `GEMINI_API_KEY` เพื่อใช้งานโมเดลจริง\n',
    ].join('');

    const tokens = reply.match(/\s*\S+/g) ?? [reply];
    for (const token of tokens) {
      if (request.signal.aborted) return;
      yield token;
      if (delay > 0) await sleep(delay);
    }
  }
}
