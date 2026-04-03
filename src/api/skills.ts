import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { jsonError, jsonSuccess } from '../lib/http';
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
  userId: z.string().min(1),
});

const completeLessonSchema = z.object({
  userId: z.string().min(1),
});

app.post('/create', zValidator('json', createSkillSchema), async (c) => {
  const payload = c.req.valid('json');

  const result = await createSkillForUser(c.env, c.env.DB, {
    topic: payload.topic,
    userId: payload.userId,
  });

  if (!result) {
    return jsonError(c, 404, 'User was not found');
  }

  return jsonSuccess(c, result, 201);
});

app.get('/:skillId/progress', async (c) => {
  const userId = c.req.query('userId');
  const skillId = c.req.param('skillId');

  if (!userId) {
    return jsonError(c, 400, 'userId query parameter is required');
  }

  const progress = await getUserSkillProgress(c.env.DB, userId, skillId);
  const xpLogs = await getUserSkillXpLogs(c.env.DB, userId, skillId);

  return jsonSuccess(c, {
    ...progress,
    xpLogs,
  });
});

app.post('/lessons/:lessonId/complete', zValidator('json', completeLessonSchema), async (c) => {
  const payload = c.req.valid('json');
  const lessonId = c.req.param('lessonId');
  const completion = await completeSkillLesson(c.env.DB, {
    userId: payload.userId,
    lessonId,
  });

  if (!completion) {
    return jsonError(c, 404, 'Lesson was not found');
  }

  return jsonSuccess(c, completion);
});

export default app;
