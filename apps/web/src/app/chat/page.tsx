"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { RoomChat } from "@/components/chat/room-chat";
import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest, postJson } from "@/lib/api-client";
import type { Room } from "@/types/domain";

export default function ChatPage() {
  return (
    <ProtectedPage>
      {() => <ChatWorkspace />}
    </ProtectedPage>
  );
}

function ChatWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [roomName, setRoomName] = useState("");

  const roomsQuery = useQuery({
    queryKey: ["chat-rooms"],
    queryFn: () => apiRequest<Room[]>("/rooms"),
  });

  const createRoomMutation = useMutation({
    mutationFn: () =>
      postJson<{ id: string }>("/rooms", {
        roomType: "peer_room",
        name: roomName,
      }),
    onSuccess: async (room) => {
      setRoomName("");
      await queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
      router.push(`/chat?roomId=${room.id}`);
    },
  });

  const selectedRoomId =
    searchParams.get("roomId") ?? roomsQuery.data?.[0]?.id ?? null;
  const selectedRoom = useMemo(
    () => (roomsQuery.data ?? []).find((room) => room.id === selectedRoomId) ?? null,
    [roomsQuery.data, selectedRoomId],
  );

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Chat"
        title="Rooms, messages, and realtime collaboration."
        description="Use this view for peer rooms, project spaces, and the broader collaboration loop."
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
              Your rooms
            </p>
            <h2 className="section-title text-3xl font-bold">Switch context quickly</h2>
          </div>

          <div className="space-y-3">
            {(roomsQuery.data ?? []).map((room) => (
              <button
                key={room.id}
                type="button"
                className={`w-full rounded-[22px] border p-4 text-left transition ${
                  selectedRoomId === room.id
                    ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                    : "border-[var(--border)] bg-white/80"
                }`}
                onClick={() => router.push(`/chat?roomId=${room.id}`)}
              >
                <p className="font-semibold">{room.name}</p>
                <p className="text-sm text-[var(--muted)]">{room.roomType}</p>
              </button>
            ))}
          </div>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!roomName.trim()) {
                return;
              }
              createRoomMutation.mutate();
            }}
          >
            <input
              className="field"
              placeholder="Create a quick peer room"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
            />
            <button
              type="submit"
              className="secondary-button"
              disabled={createRoomMutation.isPending}
            >
              <PlusCircle className="h-4 w-4" />
              Create room
            </button>
          </form>
        </Panel>

        <RoomChat roomId={selectedRoomId} roomName={selectedRoom?.name ?? "Room"} />
      </div>
    </div>
  );
}
