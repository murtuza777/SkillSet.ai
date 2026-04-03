import { DurableObject } from 'cloudflare:workers';

import { verifyRoomToken } from '../lib/auth';
import { createMessage } from '../services/chat-service';
import type { AppBindings } from '../types';

interface RoomEvent {
  type: string;
  payload: unknown;
}

export class RoomHub extends DurableObject<AppBindings> {
  constructor(ctx: DurableObjectState, env: AppBindings) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const roomsMatch = url.pathname.match(/\/rooms\/([^/]+)/);
    const pathRoomId = roomsMatch?.[1] ?? null;

    if (request.method === 'POST' && url.pathname.includes('/broadcast')) {
      const event = (await request.json()) as RoomEvent;
      this.broadcast(event);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!pathRoomId) {
      return new Response('Room id is required', { status: 400 });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket upgrade', { status: 426 });
    }

    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing room token', { status: 401 });
    }

    let roomToken: Awaited<ReturnType<typeof verifyRoomToken>>;

    try {
      roomToken = await verifyRoomToken(this.env, token);
    } catch {
      return new Response('Invalid room token', { status: 401 });
    }

    if (roomToken.roomId !== pathRoomId) {
      return new Response('Room token does not match requested room', { status: 403 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.serializeAttachment({
      roomId: pathRoomId,
      userId: roomToken.userId,
      email: roomToken.email,
      role: roomToken.role,
    });

    this.ctx.acceptWebSocket(server);
    this.broadcast({
      type: 'presence.update',
      payload: {
        roomId: pathRoomId,
        userId: roomToken.userId,
        status: 'online',
      },
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = webSocket.deserializeAttachment() as {
      roomId: string;
      userId: string;
    };

    const event =
      typeof message === 'string'
        ? (JSON.parse(message) as RoomEvent)
        : (JSON.parse(new TextDecoder().decode(message)) as RoomEvent);

    if (event.type === 'message.send') {
      const payload = event.payload as {
        messageType?: string;
        body: string;
        attachments?: unknown;
        replyToMessageId?: string | null;
      };

      const storedMessage = await createMessage(this.env.DB, {
        roomId: attachment.roomId,
        senderId: attachment.userId,
        messageType: payload.messageType,
        body: payload.body,
        attachments: payload.attachments,
        replyToMessageId: payload.replyToMessageId,
      });

      this.broadcast({
        type: 'message.received',
        payload: storedMessage,
      });

      return;
    }

    if (
      event.type === 'typing.start' ||
      event.type === 'typing.stop' ||
      event.type === 'presence.update' ||
      event.type === 'task.progress' ||
      event.type === 'project.event'
    ) {
      this.broadcast({
        type: event.type,
        payload: {
          ...(event.payload as Record<string, unknown>),
          userId: attachment.userId,
          roomId: attachment.roomId,
        },
      });
    }
  }

  webSocketClose(webSocket: WebSocket): void {
    const attachment = webSocket.deserializeAttachment() as {
      roomId: string;
      userId: string;
    };

    this.broadcast({
      type: 'presence.update',
      payload: {
        roomId: attachment.roomId,
        userId: attachment.userId,
        status: 'offline',
      },
    });
  }

  webSocketError(webSocket: WebSocket): void {
    this.webSocketClose(webSocket);
  }

  private broadcast(event: RoomEvent) {
    const encoded = JSON.stringify(event);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(encoded);
    }
  }
}
