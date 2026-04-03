import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { jsonError, jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import {
  completeSkillLesson,
  createSkillForUser,
  getUserSkillProgress,
  getUserSkillXpLogs,
} from '../services/skillService';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const createSkillSchema = z.object({
  topic: z.string().min(2),
  userId: z.string().min(1).optional(),
  goalType: z.string().optional(),
  difficulty: z.string().optional(),
  preferredContentType: z.string().optional(),
});

const completeLessonSchema = z.object({
  userId: z.string().min(1).optional(),
});

app.post('/create', requireAuth, zValidator('json', createSkillSchema), async (c) => {
  const authUser = requireCurrentUser(c);
  const payload = c.req.valid('json');
  const userId = payload.userId ?? authUser.id;

  const result = await createSkillForUser(c.env, c.env.DB, {
    topic: payload.topic,
    userId,
    goalType: payload.goalType,
    difficulty: payload.difficulty,
    preferredContentType: payload.preferredContentType,
  });

  if (!result) {
    return jsonError(c, 404, 'User was not found');
  }

  return jsonSuccess(c, result, 201);
});

app.get('/:skillId/progress', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const userId = c.req.query('userId') ?? authUser.id;
  const skillId = c.req.param('skillId');

  const progress = await getUserSkillProgress(c.env.DB, userId, skillId);
  const xpLogs = await getUserSkillXpLogs(c.env.DB, userId, skillId);

  return jsonSuccess(c, {
    ...progress,
    xpLogs,
  });
});

app.post('/lessons/:lessonId/complete', requireAuth, zValidator('json', completeLessonSchema), async (c) => {
  const authUser = requireCurrentUser(c);
  const payload = c.req.valid('json');
  const lessonId = c.req.param('lessonId');
  const completion = await completeSkillLesson(c.env.DB, {
    userId: payload.userId ?? authUser.id,
    lessonId,
  });

  if (!completion) {
    return jsonError(c, 404, 'Lesson was not found');
  }

  return jsonSuccess(c, completion);
});

export default app;
