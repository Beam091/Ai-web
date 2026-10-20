import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from './types';
import { AppError, errorBody, errors } from './lib/errors';
import { csrfGuard } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { chatRoutes } from './routes/chat';
import { conversationRoutes } from './routes/conversations';
import { modelRoutes } from './routes/models';

const app = new Hono<AppEnv>().basePath('/api');

app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  await next();

  c.header('x-request-id', requestId);
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'strict-origin-when-cross-origin');
  c.header('x-frame-options', 'DENY');
  if (!c.res.headers.get('content-type')?.includes('text/event-stream')) {
    c.header('cache-control', 'no-store');
  }
});

app.use('*', csrfGuard);

app.use(
  '*',
  bodyLimit({
    maxSize: 256 * 1024,
    onError: (c) => c.json(errorBody('PAYLOAD_TOO_LARGE', 'ข้อมูลที่ส่งมีขนาดใหญ่เกินกำหนด'), 413),
  }),
);

app.get('/health', async (c) => {
  let database: 'ok' | 'error' = 'ok';
  try {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
  } catch {
    database = 'error';
  }
  return c.json({
    status: database === 'ok' ? 'ok' : 'degraded',
    service: 'ai-web',
    environment: c.env.APP_ENV ?? 'unknown',
    database,
    time: new Date().toISOString(),
  });
});

app.route('/auth', authRoutes);
app.route('/models', modelRoutes);
app.route('/conversations', conversationRoutes);
app.route('/chat', chatRoutes);

app.notFound((c) => c.json(errorBody('NOT_FOUND', 'ไม่พบ API ที่ร้องขอ'), 404));

app.onError((error, c) => {
  if (error instanceof AppError) {
    if (error.status >= 500) console.error('app_error', { requestId: c.get('requestId'), code: error.code });
    return c.json(errorBody(error.code, error.expose ? error.message : 'เกิดข้อผิดพลาดภายในระบบ'), error.status as 400);
  }
  console.error('unhandled_error', {
    requestId: c.get('requestId'),
    name: error instanceof Error ? error.name : 'unknown',
  });
  return c.json(errorBody('INTERNAL_ERROR', 'เกิดข้อผิดพลาดภายในระบบ'), 500);
});

export default app;

export { app, errors };
