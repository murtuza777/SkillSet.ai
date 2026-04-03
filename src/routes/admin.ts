import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { jsonSuccess } from '../lib/http';
import { requireAuth, requireRole } from '../middleware/auth';
import { queueReindex } from '../services/content-service';
import { createAdminContentSource, createBadgeDefinition, getAdminMetrics, reindexSkill } from '../services/admin-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const contentSourceSchema = z.object({
  provider: z.string().min(1),
  sourceType: z.string().min(1),
  canonicalUrl: z.string().url(),
  externalId: z.string().nullable().optional(),
  title: z.string().min(2),
  authorName: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  qualityScore: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const badgeSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  ruleJson: z.unknown().optional(),
  iconUrl: z.string().url().nullable().optional(),
  rarity: z.string().nullable().optional(),
});

const reindexSkillSchema = z.object({
  skillId: z.string().optional(),
  skillSlug: z.string().optional(),
});

app.use('*', requireAuth, requireRole('admin'));

app.get('/metrics', async (c) => {
  const metrics = await getAdminMetrics(c.env.DB);
  return jsonSuccess(c, metrics);
});

app.post(
  '/content-sources',
  zValidator('json', contentSourceSchema),
  async (c) => {
    const sourceId = await createAdminContentSource(c.env.DB, c.req.valid('json'));
    await queueReindex(c.env, {
      type: 'reindex_source',
      sourceId,
    });
    return jsonSuccess(c, { id: sourceId }, 201);
  },
);

app.post(
  '/badges',
  zValidator('json', badgeSchema),
  async (c) => {
    const badgeId = await createBadgeDefinition(c.env.DB, c.req.valid('json'));
    return jsonSuccess(c, { id: badgeId }, 201);
  },
);

app.post(
  '/reindex-skill',
  zValidator('json', reindexSkillSchema),
  async (c) => {
    await reindexSkill(c.env, c.req.valid('json'));
    return jsonSuccess(c, { queued: true });
  },
);

export default app;
