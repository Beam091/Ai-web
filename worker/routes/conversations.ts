import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { errors } from '../lib/errors';
import { createConversationSchema, renameSchema, zodMessage } from '../lib/validation';
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  listMessages,
  renameConversation,
  toConversationSummary,
} from '../db/queries';
import { newId } from '../lib/crypto';
import { requireAuth } from '../middleware/auth';
import { resolveModel } from '../providers/catalog';

export const conversationRoutes = new Hono<AppEnv>();

conversationRoutes.use('*', requireAuth);

conversationRoutes.get('/', async (c) => {
  const items = await listConversations(c.env, c.get('user').id);
  return c.json({ conversations: items });
});

conversationRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) throw errors.badRequest(zodMessage(parsed.error), 'VALIDATION_ERROR');

  if (!resolveModel(c.env, parsed.data.provider, parsed.data.model)) {
    throw errors.badRequest('ไม่พบproviderหรือโมเดลที่เลือก', 'MODEL_NOT_ALLOWED');
  }

  const conversation = await createConversation(c.env, {
    id: newId(),
    userId: c.get('user').id,
    title: parsed.data.title?.trim() || 'บทสนทนาใหม่',
    provider: parsed.data.provider,
    model: parsed.data.model,
  });
  return c.json({ conversation: toConversationSummary(conversation) }, 201);
});

conversationRoutes.get('/:id', async (c) => {
  const userId = c.get('user').id;
  const conversation = await getConversation(c.env, userId, c.req.param('id'));
  if (!conversation) throw errors.notFound('ไม่พบบทสนทนานี้');
  const messages = await listMessages(c.env, conversation.id);
  return c.json({
    conversation: toConversationSummary(conversation),
    messages,
  });
});

conversationRoutes.patch('/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) throw errors.badRequest(zodMessage(parsed.error), 'VALIDATION_ERROR');

  const ok = await renameConversation(c.env, c.get('user').id, c.req.param('id'), parsed.data.title);
  if (!ok) throw errors.notFound('ไม่พบบทสนทนานี้');
  return c.json({ ok: true, title: parsed.data.title });
});

conversationRoutes.delete('/:id', async (c) => {
  const ok = await deleteConversation(c.env, c.get('user').id, c.req.param('id'));
  if (!ok) throw errors.notFound('ไม่พบบทสนทนานี้');
  return c.json({ ok: true });
});
