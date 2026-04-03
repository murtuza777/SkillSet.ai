import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { jsonError, jsonSuccess } from '../lib/http';
import { createSquadChatSession, getSquadMessages, sendSquadMessage } from '../services/chatService';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const sendMessageSchema = z.object({
  squadId: z.string().min(1),
  userId: z.string().min(1),
  message: z.string().min(1).max(4000),
});

app.post('/send', zValidator('json', sendMessageSchema), async (c) => {
  const payload = c.req.valid('json');
  const message = await sendSquadMessage(c.env, c.env.DB, payload);

  if (message === null) {
    return jsonError(c, 404, 'Squad was not found');
  }

  if (message === undefined) {
    return jsonError(c, 403, 'User is not a squad member');
  }

  return jsonSuccess(c, message, 201);
});

app.get('/messages', async (c) => {
  const squadId = c.req.query('squadId');
  const userId = c.req.query('userId');

  if (!squadId || !userId) {
    return jsonError(c, 400, 'squadId and userId query parameters are required');
  }

  const messages = await getSquadMessages(c.env.DB, { squadId, userId });
  if (messages === null) {
    return jsonError(c, 404, 'Squad was not found');
  }

  if (messages === undefined) {
    return jsonError(c, 403, 'User is not a squad member');
  }

  return jsonSuccess(c, messages);
});

app.get('/ws', async (c) => {
  const squadId = c.req.query('squadId');
  const userId = c.req.query('userId');

  if (!squadId || !userId) {
    return jsonError(c, 400, 'squadId and userId query parameters are required');
  }

  const session = await createSquadChatSession(c.env, c.env.DB, {
    squadId,
    userId,
    requestUrl: c.req.url,
  });
  if (session === null) {
    return jsonError(c, 404, 'Squad or user was not found');
  }

  if (session === undefined) {
    return jsonError(c, 403, 'User is not a squad member');
  }

  return jsonSuccess(c, session);
});

export default app;
