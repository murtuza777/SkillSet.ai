import { allRows, firstRow, runStatement } from '../db/client';
import { isoNow, randomId, safeJsonParse } from '../lib/crypto';
import type { AppBindings } from '../types';

export const ensureRoomMember = async (db: D1Database, roomId: string, userId: string) => {
  const row = await firstRow<{ room_id: string }>(
    db,
    `SELECT room_id
     FROM chat_room_members
     WHERE room_id = ?
       AND user_id = ?
     LIMIT 1`,
    [roomId, userId],
  );

  return Boolean(row);
};

export const listRooms = async (db: D1Database, userId: string) =>
  allRows<{
    id: string;
    room_type: string;
    name: string;
    related_project_id: string | null;
    related_module_id: string | null;
    created_at: string;
    latest_message_at: string | null;
  }>(
    db,
    `SELECT
       cr.id,
       cr.room_type,
       cr.name,
       cr.related_project_id,
       cr.related_module_id,
       cr.created_at,
       MAX(m.created_at) AS latest_message_at
     FROM chat_rooms cr
     JOIN chat_room_members crm ON crm.room_id = cr.id
     LEFT JOIN messages m ON m.room_id = cr.id
     WHERE crm.user_id = ?
     GROUP BY cr.id, cr.room_type, cr.name, cr.related_project_id, cr.related_module_id, cr.created_at
     ORDER BY latest_message_at DESC, cr.created_at DESC`,
    [userId],
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      roomType: row.room_type,
      name: row.name,
      relatedProjectId: row.related_project_id,
      relatedModuleId: row.related_module_id,
      createdAt: row.created_at,
      latestMessageAt: row.latest_message_at,
    })),
  );

export const createRoom = async (
  db: D1Database,
  payload: {
    createdBy: string;
    roomType: 'peer_room' | 'project_room' | 'module_room' | 'cohort_room';
    name: string;
    relatedProjectId?: string | null;
    relatedModuleId?: string | null;
    memberUserIds?: string[];
  },
) => {
  const roomId = randomId();
  const members = Array.from(new Set([payload.createdBy, ...(payload.memberUserIds ?? [])]));

  await runStatement(
    db,
    `INSERT INTO chat_rooms
      (id, room_type, name, related_project_id, related_module_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      roomId,
      payload.roomType,
      payload.name,
      payload.relatedProjectId ?? null,
      payload.relatedModuleId ?? null,
      payload.createdBy,
      isoNow(),
    ],
  );

  for (const memberUserId of members) {
    await runStatement(
      db,
      `INSERT INTO chat_room_members (id, room_id, user_id, role, joined_at, last_read_message_id)
       VALUES (?, ?, ?, 'member', ?, NULL)`,
      [randomId(), roomId, memberUserId, isoNow()],
    );
  }

  return roomId;
};

export const getRoomMessages = async (db: D1Database, roomId: string) =>
  allRows<{
    id: string;
    sender_id: string;
    message_type: string;
    body: string;
    attachments_json: string | null;
    reply_to_message_id: string | null;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
    display_name: string;
  }>(
    db,
    `SELECT
       m.id,
       m.sender_id,
       m.message_type,
       m.body,
       m.attachments_json,
       m.reply_to_message_id,
       m.created_at,
       m.edited_at,
       m.deleted_at,
       p.display_name
     FROM messages m
     JOIN profiles p ON p.user_id = m.sender_id
     WHERE m.room_id = ?
     ORDER BY m.created_at ASC
     LIMIT 200`,
    [roomId],
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderName: row.display_name,
      messageType: row.message_type,
      body: row.body,
      attachments: safeJsonParse(row.attachments_json, null),
      replyToMessageId: row.reply_to_message_id,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      deletedAt: row.deleted_at,
    })),
  );

export const createMessage = async (
  db: D1Database,
  payload: {
    roomId: string;
    senderId: string;
    messageType?: string;
    body: string;
    attachments?: unknown;
    replyToMessageId?: string | null;
  },
) => {
  const messageId = randomId();
  const createdAt = isoNow();

  await runStatement(
    db,
    `INSERT INTO messages
      (id, room_id, sender_id, message_type, body, attachments_json, reply_to_message_id, created_at, edited_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    [
      messageId,
      payload.roomId,
      payload.senderId,
      payload.messageType ?? 'text',
      payload.body,
      payload.attachments ? JSON.stringify(payload.attachments) : null,
      payload.replyToMessageId ?? null,
      createdAt,
    ],
  );

  const profile = await firstRow<{ display_name: string | null }>(
    db,
    `SELECT display_name FROM profiles WHERE user_id = ? LIMIT 1`,
    [payload.senderId],
  );

  return {
    id: messageId,
    roomId: payload.roomId,
    senderId: payload.senderId,
    senderName: profile?.display_name ?? undefined,
    messageType: payload.messageType ?? 'text',
    body: payload.body,
    attachments: payload.attachments ?? null,
    replyToMessageId: payload.replyToMessageId ?? null,
    createdAt,
    editedAt: null as string | null,
    deletedAt: null as string | null,
  };
};

export const broadcastRoomEvent = async (
  env: AppBindings,
  roomId: string,
  event: { type: string; payload: unknown },
  request?: Request,
) => {
  const stub = env.ROOM_HUB.get(env.ROOM_HUB.idFromName(roomId));
  const originFromRequest = request ? new URL(request.url).origin : '';
  const configured = (env.APP_BASE_URL ?? '').replace(/\/$/, '');
  const base = originFromRequest || configured;

  if (!base) {
    console.error('broadcastRoomEvent: set APP_BASE_URL or invoke from an HTTP request');
    return;
  }

  const internalUrl = `${base}/internal/rooms/${encodeURIComponent(roomId)}/broadcast`;
  const res = await stub.fetch(internalUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('broadcastRoomEvent failed', res.status, detail);
  }
};

/** Build a browser-safe WebSocket URL (honours X-Forwarded-* when present). */
export const buildRoomSocketUrl = (input: Request | string, roomId: string, token: string) => {
  const parsed = typeof input === 'string' ? new URL(input) : new URL(input.url);
  const forwardedProto =
    typeof input !== 'string' ? input.headers.get('x-forwarded-proto') : null;
  const forwardedHost =
    typeof input !== 'string'
      ? input.headers.get('x-forwarded-host') ?? input.headers.get('host')
      : null;

  const host = forwardedHost?.split(',')[0]?.trim() ?? parsed.host;
  const protoRaw =
    forwardedProto?.split(',')[0]?.trim() ?? parsed.protocol.replace(':', '');
  const proto = protoRaw.toLowerCase();
  const wsProto = proto === 'https' ? 'wss' : 'ws';

  const out = new URL(`${wsProto}://${host}/ws/rooms/${encodeURIComponent(roomId)}`);
  out.searchParams.set('token', token);
  return out.toString();
};
