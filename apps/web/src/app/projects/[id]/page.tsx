"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { use } from "react";

import { RoomChat } from "@/components/chat/room-chat";
import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest, patchJson, postJson } from "@/lib/api-client";
import type { Project, ProjectMember } from "@/types/domain";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ProtectedPage>
      {() => <ProjectWorkspace params={params} />}
    </ProtectedPage>
  );
}

function ProjectWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: () => apiRequest<Project>(`/projects/${id}`),
  });

  const membersQuery = useQuery({
    queryKey: ["project-members", id],
    queryFn: () => apiRequest<ProjectMember[]>(`/projects/${id}/members`),
  });

  const joinMutation = useMutation({
    mutationFn: () => postJson<Project>(`/projects/${id}/join`),
    onSuccess: () => {
      projectQuery.refetch();
      membersQuery.refetch();
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      patchJson<Project>(`/projects/${id}`, {
        status: "completed",
      }),
    onSuccess: () => projectQuery.refetch(),
  });

  const project = projectQuery.data;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Project room"
        title={project?.title ?? "Loading project..."}
        description={project?.description ?? "Review members, project state, and the linked room."}
        action={
          <div className="flex gap-3">
            <button
              type="button"
              className="secondary-button"
              disabled={joinMutation.isPending}
              onClick={() => joinMutation.mutate()}
            >
              Join project
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
            >
              Mark complete
            </button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <Panel className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
              Project details
            </p>
            <p className="text-[var(--muted)]">Visibility: {project?.visibility}</p>
            <p className="text-[var(--muted)]">Status: {project?.status}</p>
            {project?.repoUrl ? (
              <a href={project.repoUrl} target="_blank" rel="noreferrer" className="secondary-button">
                Open repository
              </a>
            ) : null}
          </Panel>

          <Panel className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
              Team members
            </p>
            <div className="space-y-3">
              {(membersQuery.data ?? []).map((member) => (
                <div
                  key={member.userId}
                  className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                >
                  <p className="font-semibold">{member.displayName}</p>
                  <p className="text-sm text-[var(--muted)]">{member.role}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <RoomChat roomId={project?.roomId ?? null} roomName={project?.title ?? "Project room"} />
      </div>
    </div>
  );
}
