"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { postJson } from "@/lib/api-client";
import { useChatStore } from "@/stores/chat-store";
import type { Message, RoomJoinToken } from "@/types/domain";

interface RoomEvent {
  type: string;
  payload: Message | { userId: string; status?: string; roomId?: string };
}

export const useRoomSocket = (roomId: string | null) => {
  const socketRef = useRef<WebSocket | null>(null);
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
    if (!roomId) {
      setConnectionState("idle");
      return;
    }

    let isMounted = true;
    setConnectionState("connecting");

    postJson<RoomJoinToken>(`/rooms/${roomId}/join-token`)
      .then((session) => {
        if (!isMounted) {
          return;
        }

        const socket = new WebSocket(session.websocketUrl);
        socketRef.current = socket;
        socket.addEventListener("open", () => setConnectionState("open"));
        socket.addEventListener("close", () => setConnectionState("closed"));
        socket.addEventListener("message", (messageEvent) => {
          const payload = JSON.parse(messageEvent.data) as RoomEvent;
          handleEvent(payload);
        });
      })
      .catch(() => {
        if (isMounted) {
          setConnectionState("closed");
        }
      });

    return () => {
      isMounted = false;
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
