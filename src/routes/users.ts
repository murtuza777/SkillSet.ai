import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { jsonError, jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { getUserWithProfile } from '../services/auth-service';
import { logActivity } from '../services/gamification-service';
import { getPublicProfile, getUserActivity, replaceUserSkills, updateProfile } from '../services/user-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const updateProfileSchema = z.object({
  displayName: z.string().min(2).optional(),
  bio: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  experienceLevel: z.string().nullable().optional(),
  weeklyHours: z.number().int().min(1).max(80).nullable().optional(),
});

const replaceSkillsSchema = z.object({
  skills: z.array(
    z.object({
      skillId: z.string().min(1),
      direction: z.enum(['have', 'want']),
      proficiencyLevel: z.string().nullable().optional(),
      targetLevel: z.string().nullable().optional(),
      priority: z.number().int().nullable().optional(),
    }),
  ),
});

app.get('/me', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const user = await getUserWithProfile(c.env.DB, authUser.id);

  if (!user) {
    return jsonError(c, 404, 'User not found');
  }

  return jsonSuccess(c, user);
});

app.patch(
  '/me',
  requireAuth,
  zValidator('json', updateProfileSchema),
  async (c) => {
    const payload = c.req.valid('json');
    const authUser = requireCurrentUser(c);

    await updateProfile(c.env.DB, authUser.id, payload);
    await logActivity(c.env.DB, {
      userId: authUser.id,
      eventType: 'profile_updated',
      entityType: 'profile',
      entityId: authUser.id,
    });

    const user = await getUserWithProfile(c.env.DB, authUser.id);
    return jsonSuccess(c, user);
  },
);

app.get('/me/activity', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const activity = await getUserActivity(c.env.DB, authUser.id);
  return jsonSuccess(c, activity);
});

app.put(
  '/me/skills',
  requireAuth,
  zValidator('json', replaceSkillsSchema),
  async (c) => {
    const authUser = requireCurrentUser(c);
    const payload = c.req.valid('json');

    await replaceUserSkills(c.env.DB, authUser.id, payload.skills);
    await logActivity(c.env.DB, {
      userId: authUser.id,
      eventType: 'skills_updated',
      entityType: 'profile',
      entityId: authUser.id,
    });

    const profile = await getPublicProfile(c.env.DB, authUser.id);
    return jsonSuccess(c, profile);
  },
);

app.get('/profiles/:id', requireAuth, async (c) => {
  const profile = await getPublicProfile(c.env.DB, c.req.param('id'));

  if (!profile) {
    return jsonError(c, 404, 'Profile not found');
  }

  return jsonSuccess(c, profile);
});

export default app;
