import type { Env, SessionUser } from '../types';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: number;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  provider: string;
  model: string;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  provider: string | null;
  model: string | null;
  status: 'complete' | 'error' | 'aborted';
  seq: number;
  created_at: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider: string | null;
  model: string | null;
  status: 'complete' | 'error' | 'aborted';
  createdAt: number;
}

export async function findUserByEmail(env: Env, email: string): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first<UserRow>();
}

export async function countUsers(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM users').first<{ total: number }>();
  return row?.total ?? 0;
}

export async function createUser(
  env: Env,
  input: { id: string; email: string; passwordHash: string; role: 'admin' | 'user' },
): Promise<UserRow> {
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
  )
    .bind(input.id, input.email, input.passwordHash, input.role, now)
    .run();
  return { id: input.id, email: input.email, password_hash: input.passwordHash, role: input.role, created_at: now };
}

export async function createSession(env: Env, tokenHash: string, userId: string, ttlMs: number): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)',
  )
    .bind(tokenHash, userId, now, now + ttlMs)
    .run();
}

export async function findSessionUser(
  env: Env,
  tokenHash: string,
  now = Date.now(),
): Promise<SessionUser | null> {
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
  )
    .bind(tokenHash, now)
    .first<SessionUser>();
  return row ?? null;
}

export async function deleteSession(env: Env, tokenHash: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
}

export async function deleteExpiredSessions(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?1').bind(now).run();
  // Housekeeping for the fixed-window rate limiter: keep only recent windows.
  await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - 86_400_000).run();
}

export function toConversationSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listConversations(env: Env, userId: string): Promise<ConversationSummary[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM conversations WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 200',
  )
    .bind(userId)
    .all<ConversationRow>();
  return results.map(toConversationSummary);
}

export async function getConversation(
  env: Env,
  userId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  return env.DB.prepare('SELECT * FROM conversations WHERE id = ?1 AND user_id = ?2')
    .bind(conversationId, userId)
    .first<ConversationRow>();
}

export async function createConversation(
  env: Env,
  input: { id: string; userId: string; title: string; provider: string; model: string },
): Promise<ConversationRow> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO conversations (id, user_id, title, provider, model, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
  )
    .bind(input.id, input.userId, input.title, input.provider, input.model, now)
    .run();
  return {
    id: input.id,
    user_id: input.userId,
    title: input.title,
    provider: input.provider,
    model: input.model,
    created_at: now,
    updated_at: now,
  };
}

export async function renameConversation(
  env: Env,
  userId: string,
  conversationId: string,
  title: string,
): Promise<boolean> {
  const result = await env.DB.prepare(
    'UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4',
  )
    .bind(title, Date.now(), conversationId, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteConversation(env: Env, userId: string, conversationId: string): Promise<boolean> {
  const result = await env.DB.prepare('DELETE FROM conversations WHERE id = ?1 AND user_id = ?2')
    .bind(conversationId, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function listMessages(env: Env, conversationId: string): Promise<Message[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM messages WHERE conversation_id = ?1 ORDER BY seq ASC LIMIT 500',
  )
    .bind(conversationId)
    .all<MessageRow>();
  return results.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    model: row.model,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/** Last N non-empty messages, chronological, within a character budget. */
export async function loadContextMessages(
  env: Env,
  conversationId: string,
  limit = 40,
  charBudget = 24_000,
): Promise<Message[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM (
       SELECT * FROM messages
       WHERE conversation_id = ?1 AND content <> ''
       ORDER BY seq DESC LIMIT ?2
     ) ORDER BY seq ASC`,
  )
    .bind(conversationId, limit)
    .all<MessageRow>();

  const kept: MessageRow[] = [];
  let used = 0;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    const row = results[i];
    if (used + row.content.length > charBudget && kept.length > 0) break;
    kept.unshift(row);
    used += row.content.length;
  }
  return kept.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    model: row.model,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function appendMessage(
  env: Env,
  input: {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    provider?: string | null;
    model?: string | null;
    status?: 'complete' | 'error' | 'aborted';
  },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, provider, model, status, seq, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, COALESCE(MAX(seq), 0) + 1, ?8
     FROM messages WHERE conversation_id = ?2`,
  )
    .bind(
      input.id,
      input.conversationId,
      input.role,
      input.content,
      input.provider ?? null,
      input.model ?? null,
      input.status ?? 'complete',
      Date.now(),
    )
    .run();
}

export async function touchConversation(
  env: Env,
  conversationId: string,
  provider: string,
  model: string,
): Promise<void> {
  await env.DB.prepare(
    'UPDATE conversations SET updated_at = ?1, provider = ?2, model = ?3 WHERE id = ?4',
  )
    .bind(Date.now(), provider, model, conversationId)
    .run();
}
