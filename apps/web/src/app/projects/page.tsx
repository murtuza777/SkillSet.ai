"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest } from "@/lib/api-client";
import type { Room } from "@/types/domain";

export default function ProjectsIndexPage() {
  return (
    <ProtectedPage>
      {() => <ProjectsIndexWorkspace />}
    </ProtectedPage>
  );
}

function ProjectsIndexWorkspace() {
  const roomsQuery = useQuery({
    queryKey: ["project-rooms"],
    queryFn: () => apiRequest<Room[]>("/rooms"),
  });

  const projectRooms = (roomsQuery.data ?? []).filter(
    (room) => room.roomType === "project_room",
  );

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Projects"
        title="Your collaborative project rooms"
        description="Open a project from your learning path to see members and live chat."
        action={
          <Link href="/skills" className="primary-button">
            Create from a learning path
          </Link>
        }
      />

      <Panel className="space-y-4">
        {roomsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading-spinner" />
          </div>
        ) : projectRooms.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[var(--border)] p-6 text-center text-[var(--muted)]">
            No project rooms yet. Generate a path and create your first project.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projectRooms.map((room) => (
              <Link
                key={room.id}
                href={`/chat?roomId=${room.id}`}
                className="block rounded-[22px] border border-[var(--border)] bg-white/80 p-4 transition hover:-translate-y-0.5"
              >
                <p className="font-semibold">{room.name}</p>
                <p className="text-sm text-[var(--muted)]">
                  Last active: {room.latestMessageAt ?? room.createdAt}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
