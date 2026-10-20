import { beforeEach, describe, expect, it } from 'vitest';
import { env as rawEnv, SELF } from 'cloudflare:test';
import type { Env } from '../../worker/types';

const env = rawEnv as unknown as Env;

const BASE = 'https://example.com';
const INVITE = 'test-invite-code';
const PASSWORD = 'correct-horse-battery';

interface Registered {
  cookie: string;
  user: { id: string; email: string; role: string };
}

async function register(email: string): Promise<Registered> {
  const response = await SELF.fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, inviteCode: INVITE }),
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { user: Registered['user'] };
  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
  expect(cookie).toContain('ai_session=');
  return { cookie, user: body.user };
}

function authHeaders(cookie: string, extra: Record<string, string> = {}): Record<string, string> {
  return { cookie, 'content-type': 'application/json', ...extra };
}

function parseSse(text: string): Array<{ event: string; data: Record<string, unknown> }> {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  for (const block of text.split('\n\n')) {
    if (!block.trim()) continue;
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (data.length > 0) events.push({ event, data: JSON.parse(data.join('\n')) as Record<string, unknown> });
  }
  return events;
}

async function sendChat(cookie: string, content: string, model = 'mock-echo') {
  return SELF.fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: authHeaders(cookie),
    body: JSON.stringify({ conversationId: null, content, provider: 'mock', model }),
  });
}

beforeEach(async () => {
  await env.DB.exec(
    'DELETE FROM messages; DELETE FROM conversations; DELETE FROM sessions; DELETE FROM users; DELETE FROM rate_limits;',
  );
});

describe('health', () => {
  it('reports the database as reachable', async () => {
    const response = await SELF.fetch(`${BASE}/api/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; database: string };
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const response = await SELF.fetch(`${BASE}/api/nope`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('authentication', () => {
  it('makes the first user an admin and the second a regular user', async () => {
    const first = await register('first@example.com');
    const second = await register('second@example.com');
    expect(first.user.role).toBe('admin');
    expect(second.user.role).toBe('user');
  });

  it('rejects registration with the wrong invite code', async () => {
    const response = await SELF.fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com', password: PASSWORD, inviteCode: 'wrong' }),
    });
    expect(response.status).toBe(403);
  });

  it('logs in with a valid password and rejects a wrong one', async () => {
    await register('login@example.com');
    const bad = await SELF.fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password: 'not-the-password' }),
    });
    expect(bad.status).toBe(401);

    const good = await SELF.fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password: PASSWORD }),
    });
    expect(good.status).toBe(200);
    expect(good.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('rejects unauthenticated access to protected routes', async () => {
    for (const path of ['/api/conversations', '/api/models', '/api/auth/me']) {
      const response = await SELF.fetch(`${BASE}${path}`);
      expect(response.status).toBe(401);
    }
  });

  it('logs out and invalidates the session', async () => {
    const { cookie } = await register('logout@example.com');
    const out = await SELF.fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: authHeaders(cookie),
    });
    expect(out.status).toBe(200);
    const me = await SELF.fetch(`${BASE}/api/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(401);
  });
});

describe('CSRF guard', () => {
  it('blocks state-changing requests from a mismatched origin', async () => {
    const { cookie } = await register('csrf@example.com');
    const response = await SELF.fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: authHeaders(cookie, { origin: 'https://evil.example' }),
      body: JSON.stringify({ conversationId: null, content: 'hi', provider: 'mock', model: 'mock-echo' }),
    });
    expect(response.status).toBe(403);
  });

  it('allows requests from the same origin', async () => {
    const { cookie } = await register('same-origin@example.com');
    const response = await sendChat(cookie, 'hello');
    expect(response.status).toBe(200);
    await response.text();
  });
});

describe('chat + persistence', () => {
  it('streams a mock answer, saves both messages and supports rename/delete', async () => {
    const { cookie } = await register('chat@example.com');

    const response = await sendChat(cookie, 'สวัสดี Nova');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const raw = await response.text();
    const events = parseSse(raw);
    const meta = events.find((item) => item.event === 'meta');
    expect(meta).toBeTruthy();
    const conversationId = meta?.data.conversationId as string;
    expect(conversationId).toBeTruthy();

    const text = events
      .filter((item) => item.event === 'delta')
      .map((item) => item.data.text as string)
      .join('');
    expect(text).toContain('Mock Provider');
    expect(text).toContain('สวัสดี Nova');

    const done = events.find((item) => item.event === 'done');
    expect(done).toBeTruthy();
    expect(events.some((item) => item.event === 'error')).toBe(false);

    const list = await SELF.fetch(`${BASE}/api/conversations`, { headers: { cookie } });
    const listBody = (await list.json()) as { conversations: Array<{ id: string; title: string }> };
    expect(listBody.conversations).toHaveLength(1);
    expect(listBody.conversations[0].title).toContain('สวัสดี Nova');

    const detail = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      headers: { cookie },
    });
    const detailBody = (await detail.json()) as {
      messages: Array<{ role: string; content: string; status: string }>;
    };
    expect(detailBody.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(detailBody.messages[1].status).toBe('complete');
    expect(detailBody.messages[1].content).toContain('Mock Provider');

    const rename = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: authHeaders(cookie),
      body: JSON.stringify({ title: 'บทสนทนาทดสอบ' }),
    });
    expect(rename.status).toBe(200);

    const detail2 = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      headers: { cookie },
    });
    const detailBody2 = (await detail2.json()) as { conversation: { title: string } };
    expect(detailBody2.conversation.title).toBe('บทสนทนาทดสอบ');

    const remove = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: authHeaders(cookie),
    });
    expect(remove.status).toBe(200);
    const afterDelete = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      headers: { cookie },
    });
    expect(afterDelete.status).toBe(404);
  });

  it('persists the partial assistant message when the client stops reading', async () => {
    const { cookie } = await register('abort@example.com');
    const response = await sendChat(cookie, 'หยุดกลางทาง');
    expect(response.body).toBeTruthy();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    while (!raw.includes('event: delta')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      raw += decoder.decode(chunk.value, { stream: true });
    }
    await reader.cancel();

    const conversationId = parseSse(raw).find((item) => item.event === 'meta')?.data
      .conversationId as string;
    expect(conversationId).toBeTruthy();

    let messages: Array<{ role: string; status: string; content: string }> = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const detail = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
        headers: { cookie },
      });
      const body = (await detail.json()) as { messages: typeof messages };
      messages = body.messages;
      if (messages.some((message) => message.role === 'assistant')) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(messages[1].status).toBe('aborted');
    expect(messages[1].content.length).toBeGreaterThan(0);
  });

  it('keeps a multi-turn conversation and sends the stored context', async () => {
    const { cookie } = await register('multi@example.com');
    const first = parseSse(await (await sendChat(cookie, 'เทิร์นแรก')).text());
    const conversationId = first.find((item) => item.event === 'meta')?.data.conversationId as string;

    const second = await SELF.fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: authHeaders(cookie),
      body: JSON.stringify({
        conversationId,
        content: 'เทิร์นที่สอง',
        provider: 'mock',
        model: 'mock-echo',
      }),
    });
    expect(second.status).toBe(200);
    await second.text();

    const detail = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      headers: { cookie },
    });
    const body = (await detail.json()) as { messages: Array<{ role: string }> };
    expect(body.messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
  });

  it('rejects models outside the allowlist', async () => {
    const { cookie } = await register('model@example.com');
    const response = await sendChat(cookie, 'hi', 'gpt-4.1-mini');
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('MODEL_NOT_ALLOWED');
  });

  it('rejects oversized messages', async () => {
    const { cookie } = await register('size@example.com');
    const response = await sendChat(cookie, 'a'.repeat(8001));
    expect(response.status).toBe(400);
  });
});

describe('authorization / IDOR', () => {
  it('does not let one user read, rename or delete another user’s conversation', async () => {
    const owner = await register('owner@example.com');
    const intruder = await register('intruder@example.com');

    const chat = await sendChat(owner.cookie, 'ความลับของเจ้าของ');
    const conversationId = parseSse(await chat.text()).find((item) => item.event === 'meta')?.data
      .conversationId as string;

    const read = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      headers: { cookie: intruder.cookie },
    });
    expect(read.status).toBe(404);

    const rename = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: authHeaders(intruder.cookie),
      body: JSON.stringify({ title: 'ถูกแก้ไข' }),
    });
    expect(rename.status).toBe(404);

    const remove = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: authHeaders(intruder.cookie),
    });
    expect(remove.status).toBe(404);

    const chatAttempt = await SELF.fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: authHeaders(intruder.cookie),
      body: JSON.stringify({
        conversationId,
        content: 'แอบอ่าน',
        provider: 'mock',
        model: 'mock-echo',
      }),
    });
    expect(chatAttempt.status).toBe(404);

    const stillThere = await SELF.fetch(`${BASE}/api/conversations/${conversationId}`, {
      headers: { cookie: owner.cookie },
    });
    expect(stillThere.status).toBe(200);
  });

  it('only lists the current user’s conversations', async () => {
    const owner = await register('list-owner@example.com');
    const other = await register('list-other@example.com');
    await (await sendChat(owner.cookie, 'ของฉัน')).text();

    const otherList = await SELF.fetch(`${BASE}/api/conversations`, { headers: { cookie: other.cookie } });
    const body = (await otherList.json()) as { conversations: unknown[] };
    expect(body.conversations).toHaveLength(0);
  });
});
