import { firstRow } from '../db/client';
import { signRoomToken } from '../lib/auth';
import type { AppBindings } from '../types';
import { findUserById } from './auth-service';
import { broadcastRoomEvent, buildRoomSocketUrl, createMessage, getRoomMessages } from './chat-service';

const getSquadRoom = async (db: D1Database, squadId: string) =>
  firstRow<{ id: string; room_id: string; skill_id: string }>(
    db,
    `SELECT id, room_id, skill_id
     FROM squads
     WHERE id = ?
     LIMIT 1`,
    [squadId],
  );

const ensureSquadMember = async (db: D1Database, squadId: string, userId: string) => {
  const row = await firstRow<{ id: string }>(
    db,
    `SELECT id
     FROM squad_members
     WHERE squad_id = ?
       AND user_id = ?
     LIMIT 1`,
    [squadId, userId],
  );
  return Boolean(row);
};

export const sendSquadMessage = async (
  env: AppBindings,
  db: D1Database,
  payload: {
    squadId: string;
    userId: string;
    message: string;
  },
) => {
  const squad = await getSquadRoom(db, payload.squadId);
  if (!squad) {
    return null;
  }

  const isMember = await ensureSquadMember(db, payload.squadId, payload.userId);
  if (!isMember) {
    return undefined;
  }

  const stored = await createMessage(db, {
    roomId: squad.room_id,
    senderId: payload.userId,
    body: payload.message,
    messageType: 'text',
  });

  const profile = await firstRow<{ display_name: string | null }>(
    db,
    `SELECT display_name
     FROM profiles
     WHERE user_id = ?
     LIMIT 1`,
    [payload.userId],
  );

  const eventPayload = {
    ...stored,
    squadId: payload.squadId,
    senderName: profile?.display_name ?? 'User',
  };

  await broadcastRoomEvent(env, squad.room_id, {
    type: 'message.received',
    payload: eventPayload,
  });

  return eventPayload;
};

export const getSquadMessages = async (
  db: D1Database,
  payload: {
    squadId: string;
    userId: string;
  },
) => {
  const squad = await getSquadRoom(db, payload.squadId);
  if (!squad) {
    return null;
  }

  const isMember = await ensureSquadMember(db, payload.squadId, payload.userId);
  if (!isMember) {
    return undefined;
  }

  const messages = await getRoomMessages(db, squad.room_id);
  return messages.map((message) => ({
    ...message,
    squadId: payload.squadId,
  }));
};

export const createSquadChatSession = async (
  env: AppBindings,
  db: D1Database,
  payload: {
    squadId: string;
    userId: string;
    requestUrl: string;
  },
) => {
  const squad = await getSquadRoom(db, payload.squadId);
  if (!squad) {
    return null;
  }

  const isMember = await ensureSquadMember(db, payload.squadId, payload.userId);
  if (!isMember) {
    return undefined;
  }

  const user = await findUserById(db, payload.userId);
  if (!user) {
    return null;
  }

  const token = await signRoomToken(env, {
    roomId: squad.room_id,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.email_verified_at,
    },
  });

  return {
    token,
    websocketUrl: buildRoomSocketUrl(payload.requestUrl, squad.room_id, token),
  };
};
