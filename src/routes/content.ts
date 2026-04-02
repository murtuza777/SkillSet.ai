import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { jsonError, jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { requireAuth, requireRole } from '../middleware/auth';
import { discoverContent, getContentSource, queueReindex, searchContent } from '../services/content-service';
import { logActivity } from '../services/gamification-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const discoverSchema = z.object({
  skillId: z.string().optional(),
  skillSlug: z.string().optional(),
  query: z.string().optional(),
  level: z.string().optional(),
  goal: z.string().optional(),
});

const reindexSchema = z.object({
  sourceId: z.string().optional(),
  skillId: z.string().optional(),
  skillSlug: z.string().optional(),
});

app.post(
  '/discover',
  requireAuth,
  zValidator('json', discoverSchema),
  async (c) => {
    const authUser = requireCurrentUser(c);
    const payload = c.req.valid('json');
    const discovery = await discoverContent(c.env, c.env.DB, payload);

    await logActivity(c.env.DB, {
      userId: authUser.id,
      eventType: 'content_discovered',
      entityType: 'skill',
      entityId: discovery.skill?.id ?? null,
      metadata: {
        sourceCount: discovery.sources.length,
      },
    });

    return jsonSuccess(c, discovery);
  },
);

app.get('/sources/:id', async (c) => {
  const source = await getContentSource(c.env.DB, c.req.param('id'));

  if (!source) {
    return jsonError(c, 404, 'Content source not found');
  }

  return jsonSuccess(c, source);
});

app.post(
  '/reindex',
  requireAuth,
  requireRole('admin'),
  zValidator('json', reindexSchema),
  async (c) => {
    const payload = c.req.valid('json');

    if (payload.sourceId) {
      await queueReindex(c.env, {
        type: 'reindex_source',
        sourceId: payload.sourceId,
      });
    } else {
      await queueReindex(c.env, {
        type: 'reindex_skill',
        skillId: payload.skillId,
        skillSlug: payload.skillSlug,
      });
    }

    return jsonSuccess(c, {
      queued: true,
    });
  },
);

app.get('/search', async (c) => {
  const query = c.req.query('q') ?? '';

  if (!query.trim()) {
    return jsonSuccess(c, []);
  }

  const results = await searchContent(c.env.DB, query.trim());
  return jsonSuccess(c, results);
});

export default app;
