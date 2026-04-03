"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { apiRequest, postJson } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { useChatStore } from "@/stores/chat-store";
import type { Message } from "@/types/domain";

export function RoomChat({
  roomId,
  roomName,
}: {
  roomId: string | null;
  roomName: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const { send } = useRoomSocket(roomId);
  const setActiveRoomId = useChatStore((state) => state.setActiveRoomId);
  const setRoomMessages = useChatStore((state) => state.setRoomMessages);
  const messages = useChatStore(
    (state) => (roomId ? state.messagesByRoom[roomId] : []) ?? [],
  );
  const connectionState = useChatStore((state) => state.connectionState);

  const messagesQuery = useQuery({
    queryKey: ["room-messages", roomId],
    queryFn: () => apiRequest<Message[]>(`/rooms/${roomId}/messages`),
    enabled: Boolean(roomId),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!roomId) {
        return;
      }

      await postJson(`/rooms/${roomId}/messages`, {
        body: draft,
        messageType: "text",
      });
    },
    onSuccess: async () => {
      setDraft("");
      if (roomId) {
        await queryClient.invalidateQueries({ queryKey: ["room-messages", roomId] });
      }
    },
  });

  useEffect(() => {
    setActiveRoomId(roomId);
    return () => setActiveRoomId(null);
  }, [roomId, setActiveRoomId]);

  useEffect(() => {
    if (roomId && messagesQuery.data) {
      setRoomMessages(roomId, messagesQuery.data);
    }
  }, [messagesQuery.data, roomId, setRoomMessages]);

  if (!roomId) {
    return (
      <Panel className="flex min-h-[420px] items-center justify-center text-[var(--muted)]">
        Select a room to start chatting.
      </Panel>
    );
  }

  return (
    <Panel className="flex min-h-[420px] flex-col gap-4">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
            Realtime room
          </p>
          <h3 className="section-title text-2xl font-bold">{roomName}</h3>
        </div>
        <span className="pill">
          Socket: {connectionState}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{message.senderName ?? message.senderId}</p>
              <p className="text-xs text-[var(--muted)]">
                {formatDateTime(message.createdAt)}
              </p>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-[var(--ink)]">{message.body}</p>
          </div>
        ))}
      </div>

      <form
        className="flex gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) {
            return;
          }

          send({
            type: "typing.stop",
            payload: {},
          } as never);
          sendMutation.mutate();
        }}
      >
        <textarea
          className="field min-h-[88px] flex-1"
          placeholder="Share an update, ask for help, or coordinate the next step..."
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            send({
              type: "typing.start",
              payload: {},
            } as never);
          }}
        />
        <button
          type="submit"
          className="primary-button self-end"
          disabled={sendMutation.isPending}
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
    </Panel>
  );
}
