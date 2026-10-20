import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types';
import { sha256Hex } from '../lib/crypto';
import { errors } from '../lib/errors';
import { findSessionUser } from '../db/queries';

export const SESSION_COOKIE = 'ai_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) throw errors.unauthorized();

  const hash = await sha256Hex(token);
  const user = await findSessionUser(c.env, hash);
  if (!user) throw errors.unauthorized();

  c.set('user', user);
  c.set('sessionHash', hash);
  await next();
});

/**
 * Defence-in-depth CSRF protection for cookie auth:
 *  - SameSite=Lax on the session cookie
 *  - reject cross-site fetch metadata
 *  - reject Origin headers that do not match the request host
 */
export const csrfGuard = createMiddleware<AppEnv>(async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const fetchSite = c.req.header('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    throw errors.forbidden('ปฏิเสธคำขอข้ามเว็บไซต์');
  }

  const origin = c.req.header('origin');
  if (origin) {
    const host = c.req.header('host');
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = '';
    }
    if (!host || originHost !== host) {
      throw errors.forbidden('Origin ไม่ตรงกับเซิร์ฟเวอร์');
    }
  }

  return next();
});

export function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
