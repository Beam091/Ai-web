import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { defaultSelection, listProviders } from '../providers/catalog';
import { requireAuth } from '../middleware/auth';

export const modelRoutes = new Hono<AppEnv>();

modelRoutes.use('*', requireAuth);

modelRoutes.get('/', (c) => {
  return c.json({
    providers: listProviders(c.env),
    default: defaultSelection(c.env),
  });
});
