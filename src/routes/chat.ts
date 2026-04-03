import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { signRoomToken } from '../lib/auth';
import { jsonError, jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import {
  broadcastRoomEvent,
  buildRoomSocketUrl,
  createMessage,
  createRoom,
  ensureRoomMember,
  getRoomMessages,
  listRooms,
} from '../services/chat-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const createRoomSchema = z.object({
  roomType: z.enum(['peer_room', 'project_room', 'module_room', 'cohort_room']),
  name: z.string().min(2),
  relatedProjectId: z.string().nullable().optional(),
  relatedModuleId: z.string().nullable().optional(),
  memberUserIds: z.array(z.string()).optional(),
});

const createMessageSchema = z.object({
  messageType: z.string().optional(),
  body: z.string().min(1),
  attachments: z.unknown().optional(),
  replyToMessageId: z.string().nullable().optional(),
});

app.get('/rooms', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const rooms = await listRooms(c.env.DB, authUser.id);
  return jsonSuccess(c, rooms);
});

app.post(
  '/rooms',
  requireAuth,
  zValidator('json', createRoomSchema),
  async (c) => {
    const authUser = requireCurrentUser(c);
    const payload = c.req.valid('json');
    const roomId = await createRoom(c.env.DB, {
      createdBy: authUser.id,
      roomType: payload.roomType,
      name: payload.name,
      relatedProjectId: payload.relatedProjectId,
      relatedModuleId: payload.relatedModuleId,
      memberUserIds: payload.memberUserIds,
    });

    return jsonSuccess(
      c,
      {
        id: roomId,
      },
      201,
    );
  },
);

app.get('/rooms/:id/messages', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const isMember = await ensureRoomMember(c.env.DB, c.req.param('id'), authUser.id);

  if (!isMember) {
    return jsonError(c, 403, 'You are not a member of this room');
  }

  const messages = await getRoomMessages(c.env.DB, c.req.param('id'));
  return jsonSuccess(c, messages);
});

app.post(
  '/rooms/:id/messages',
  requireAuth,
  zValidator('json', createMessageSchema),
  async (c) => {
    const authUser = requireCurrentUser(c);
    const roomId = c.req.param('id');
    const isMember = await ensureRoomMember(c.env.DB, roomId, authUser.id);

    if (!isMember) {
      return jsonError(c, 403, 'You are not a member of this room');
    }

    const payload = c.req.valid('json');
    const message = await createMessage(c.env.DB, {
      roomId,
      senderId: authUser.id,
      messageType: payload.messageType,
      body: payload.body,
      attachments: payload.attachments,
      replyToMessageId: payload.replyToMessageId,
    });

    await broadcastRoomEvent(
      c.env,
      roomId,
      {
        type: 'message.received',
        payload: message,
      },
      c.req.raw,
    );

    return jsonSuccess(c, message, 201);
  },
);

app.post('/rooms/:id/join-token', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const roomId = c.req.param('id');
  const isMember = await ensureRoomMember(c.env.DB, roomId, authUser.id);

  if (!isMember) {
    return jsonError(c, 403, 'You are not a member of this room');
  }

  const token = await signRoomToken(c.env, {
    roomId,
    user: authUser,
  });

  return jsonSuccess(c, {
    token,
    websocketUrl: buildRoomSocketUrl(c.req.raw, roomId, token),
  });
});

export default app;
