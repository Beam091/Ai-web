import { Hono, type Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { newId, hashPassword, randomToken, sha256Hex, verifyPassword } from '../lib/crypto';
import { errors } from '../lib/errors';
import { checkRateLimit, intEnv } from '../lib/rate-limit';
import { loginSchema, registerSchema, zodMessage } from '../lib/validation';
import {
  countUsers,
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSession,
  findUserByEmail,
} from '../db/queries';
import { clientIp, requireAuth, SESSION_COOKIE, SESSION_TTL_MS } from '../middleware/auth';

export const authRoutes = new Hono<AppEnv>();

function publicUser(user: { id: string; email: string; role: 'admin' | 'user' }) {
  return { id: user.id, email: user.email, role: user.role };
}

async function startSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken();
  const hash = await sha256Hex(token);
  await createSession(c.env, hash, userId, SESSION_TTL_MS);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: c.env.APP_ENV !== 'development',
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') throw errors.badRequest('ข้อมูลที่ส่งไม่ถูกต้อง');

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) throw errors.badRequest(zodMessage(parsed.error), 'VALIDATION_ERROR');

  const windowMs = intEnv(c.env.LOGIN_RATE_WINDOW_MINUTES, 15, 1, 1440) * 60_000;
  const limit = intEnv(c.env.LOGIN_RATE_LIMIT, 10, 1, 1000);
  const rate = await checkRateLimit(c.env, `register:${clientIp(c)}`, limit, windowMs);
  if (!rate.allowed) throw errors.rateLimited();

  const existing = await findUserByEmail(c.env, parsed.data.email);
  if (existing) throw errors.conflict('อีเมลนี้ถูกใช้งานแล้ว');

  const total = await countUsers(c.env);
  const role: 'admin' | 'user' = total === 0 ? 'admin' : 'user';
  const passwordHash = await hashPassword(parsed.data.password);
  let user;
  try {
    user = await createUser(c.env, {
      id: newId(),
      email: parsed.data.email,
      passwordHash,
      role,
    });
  } catch {
    throw errors.conflict('ไม่สามารถสร้างบัญชีได้ อาจมีอีเมลนี้อยู่แล้ว');
  }

  await startSession(c, user.id);
  await deleteExpiredSessions(c.env).catch(() => undefined);
  return c.json({ user: publicUser(user) }, 201);
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') throw errors.badRequest('ข้อมูลที่ส่งไม่ถูกต้อง');

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) throw errors.badRequest(zodMessage(parsed.error), 'VALIDATION_ERROR');

  const windowMs = intEnv(c.env.LOGIN_RATE_WINDOW_MINUTES, 15, 1, 1440) * 60_000;
  const limit = intEnv(c.env.LOGIN_RATE_LIMIT, 10, 1, 1000);
  const rate = await checkRateLimit(
    c.env,
    `login:${clientIp(c)}:${parsed.data.email}`,
    limit,
    windowMs,
  );
  if (!rate.allowed) throw errors.rateLimited('เข้าสู่ระบบผิดพลาดหลายครั้ง กรุณาลองใหม่ภายหลัง');

  const user = await findUserByEmail(c.env, parsed.data.email);
  // Always run PBKDF2 even for unknown emails to reduce timing differences.
  const fallbackHash =
    'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const valid = user
    ? await verifyPassword(parsed.data.password, user.password_hash)
    : await verifyPassword(parsed.data.password, fallbackHash);

  if (!user || !valid) throw errors.unauthorized();

  await startSession(c, user.id);
  await deleteExpiredSessions(c.env).catch(() => undefined);
  return c.json({ user: publicUser(user) });
});

authRoutes.post('/logout', requireAuth, async (c) => {
  await deleteSession(c.env, c.get('sessionHash'));
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: c.env.APP_ENV !== 'development' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({ user: publicUser(user) });
});
