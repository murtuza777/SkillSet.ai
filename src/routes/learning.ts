import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { jsonError, jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { enrollInLearningPath, generateLearningPath, getLearningPath, getModule, submitTaskAttempt } from '../services/learning-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const generateSchema = z.object({
  skillId: z.string().optional(),
  skillSlug: z.string().optional(),
  difficulty: z.string().optional(),
  goalType: z.string().optional(),
  targetRole: z.string().optional(),
  preferredContentType: z.string().optional(),
  targetDeadline: z.string().optional(),
  timePerWeek: z.number().int().positive().max(80).optional(),
});

const submitTaskSchema = z.object({
  submissionText: z.string().optional(),
  submissionUrl: z.string().url().optional(),
});

app.post(
  '/learning-paths/generate',
  requireAuth,
  zValidator('json', generateSchema),
  async (c) => {
    const authUser = requireCurrentUser(c);
    const payload = c.req.valid('json');
    const path = await generateLearningPath(c.env, c.env.DB, authUser.id, payload);

    if (!path) {
      return jsonError(c, 404, 'Skill not found');
    }

    return jsonSuccess(c, path, 201);
  },
);

app.get('/learning-paths/:id', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const path = await getLearningPath(c.env.DB, c.req.param('id'), authUser.id);

  if (!path) {
    return jsonError(c, 404, 'Learning path not found');
  }

  return jsonSuccess(c, path);
});

app.post('/learning-paths/:id/enroll', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const path = await enrollInLearningPath(c.env.DB, authUser.id, c.req.param('id'));

  if (!path) {
    return jsonError(c, 404, 'Learning path not found');
  }

  return jsonSuccess(c, path);
});

app.get('/modules/:id', requireAuth, async (c) => {
  const module = await getModule(c.env.DB, c.req.param('id'));

  if (!module) {
    return jsonError(c, 404, 'Module not found');
  }

  return jsonSuccess(c, module);
});

app.post(
  '/tasks/:id/submit',
  requireAuth,
  zValidator('json', submitTaskSchema),
  async (c) => {
    const authUser = requireCurrentUser(c);
    const payload = c.req.valid('json');
    const attempt = await submitTaskAttempt(c.env, c.env.DB, {
      userId: authUser.id,
      taskId: c.req.param('id'),
      submissionText: payload.submissionText,
      submissionUrl: payload.submissionUrl,
    });

    if (!attempt) {
      return jsonError(c, 404, 'Task not found');
    }

    return jsonSuccess(c, attempt, 201);
  },
);

export default app;
