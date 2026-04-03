"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { postJson } from "@/lib/api-client";
import { useChatStore } from "@/stores/chat-store";
import type { Message, RoomJoinToken } from "@/types/domain";

interface RoomEvent {
  type: string;
  payload: Message | { userId: string; status?: string; roomId?: string };
}

const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_RECONNECT_MS = 900;

export const useRoomSocket = (roomId: string | null) => {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const addRoomMessage = useChatStore((state) => state.addRoomMessage);
  const setConnectionState = useChatStore((state) => state.setConnectionState);
  const setTypingUsers = useChatStore((state) => state.setTypingUsers);

  const handleEvent = useEffectEvent((event: RoomEvent) => {
    if (!roomId) {
      return;
    }

    if (event.type === "message.received") {
      addRoomMessage(roomId, event.payload as Message);
      return;
    }

    if (event.type === "typing.start") {
      const payload = event.payload as { userId: string };
      setTypingUsers(roomId, [payload.userId]);
      return;
    }

    if (event.type === "typing.stop" || event.type === "presence.update") {
      setTypingUsers(roomId, []);
    }
  });

  useEffect(() => {
    cancelledRef.current = false;

    if (!roomId) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
      setConnectionState("idle");
      reconnectAttemptsRef.current = 0;
      return;
    }

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const attachSocket = (socket: WebSocket) => {
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (cancelledRef.current) {
          return;
        }
        reconnectAttemptsRef.current = 0;
        setConnectionState("open");
      });

      socket.addEventListener("close", () => {
        socketRef.current = null;
        if (cancelledRef.current) {
          return;
        }
        setConnectionState("closed");
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          return;
        }
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          30_000,
          BASE_RECONNECT_MS * reconnectAttemptsRef.current,
        );
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          void connect();
        }, delay);
      });

      socket.addEventListener("message", (messageEvent) => {
        try {
          const payload = JSON.parse(messageEvent.data as string) as RoomEvent;
          handleEvent(payload);
        } catch {
          /* ignore malformed frames */
        }
      });
    };

    const connect = async () => {
      if (cancelledRef.current || !roomId) {
        return;
      }

      setConnectionState("connecting");

      try {
        const session = await postJson<RoomJoinToken>(`/rooms/${roomId}/join-token`);
        if (cancelledRef.current) {
          return;
        }

        const socket = new WebSocket(session.websocketUrl);
        attachSocket(socket);
      } catch {
        if (cancelledRef.current) {
          return;
        }
        setConnectionState("closed");
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          return;
        }
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          30_000,
          BASE_RECONNECT_MS * reconnectAttemptsRef.current,
        );
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          void connect();
        }, delay);
      }
    };

    reconnectAttemptsRef.current = 0;
    void connect();

    return () => {
      cancelledRef.current = true;
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
      setConnectionState("closed");
    };
  }, [roomId, setConnectionState]);

  return {
    send(event: RoomEvent) {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(event));
      }
    },
  };
};
