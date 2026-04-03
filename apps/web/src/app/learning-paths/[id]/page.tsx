"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, Layers3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest, postJson } from "@/lib/api-client";
import type { LearningPath } from "@/types/domain";

export default function LearningPathPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ProtectedPage>
      {() => <LearningPathWorkspace params={params} />}
    </ProtectedPage>
  );
}

function LearningPathWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    visibility: "private",
  });
  const pathQuery = useQuery({
    queryKey: ["learning-path", id],
    queryFn: () => apiRequest<LearningPath>(`/learning-paths/${id}`),
  });

  const enrollMutation = useMutation({
    mutationFn: () => postJson<LearningPath>(`/learning-paths/${id}/enroll`),
    onSuccess: () => pathQuery.refetch(),
  });

  const projectMutation = useMutation({
    mutationFn: () =>
      postJson<{ id: string }>("/projects", {
        learningPathId: id,
        title: projectForm.title,
        description: projectForm.description || null,
        visibility: projectForm.visibility,
      }),
    onSuccess: (project) => router.push(`/projects/${project.id}`),
  });

  const learningPath = pathQuery.data;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Learning path"
        title={learningPath?.title ?? "Loading path..."}
        description={learningPath?.description ?? "Retrieving generated modules, lessons, and tasks."}
        action={
          <button
            type="button"
            className="primary-button"
            disabled={enrollMutation.isPending}
            onClick={() => enrollMutation.mutate()}
          >
            {learningPath?.enrollment ? "Refresh enrollment" : "Enroll in path"}
            <ArrowRight className="h-4 w-4" />
          </button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="space-y-2">
          <div className="flex items-center gap-3 text-[var(--brand)]">
            <Clock3 className="h-5 w-5" />
            <p className="font-semibold">Estimated hours</p>
          </div>
          <p className="section-title text-4xl font-bold">{learningPath?.estimatedHours ?? 0}</p>
          <p className="text-sm text-[var(--muted)]">Difficulty: {learningPath?.difficulty ?? "mixed"}</p>
        </Panel>
        <Panel className="space-y-2">
          <div className="flex items-center gap-3 text-[var(--brand)]">
            <Layers3 className="h-5 w-5" />
            <p className="font-semibold">Modules</p>
          </div>
          <p className="section-title text-4xl font-bold">{learningPath?.modules.length ?? 0}</p>
          <p className="text-sm text-[var(--muted)]">Goal type: {learningPath?.goalType ?? "general"}</p>
        </Panel>
        <Panel className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
            Enrollment
          </p>
          <p className="section-title text-3xl font-bold">
            {learningPath?.enrollment?.status ?? "Not enrolled"}
          </p>
          <p className="text-sm text-[var(--muted)]">
            Progress {learningPath?.enrollment?.progressPct ?? 0}%
          </p>
        </Panel>
      </div>

      {learningPath?.collaboration ? (
        <Panel className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
              Collaborative learning
            </p>
            <h2 className="section-title text-3xl font-bold">
              Learn with peers in the {learningPath.collaboration.roomName}
            </h2>
            <p className="text-[var(--muted)]">
              Ask questions, share progress, and coordinate study sessions while you work through this path.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/chat?roomId=${learningPath.collaboration.roomId}`}
              className="primary-button"
            >
              Open squad chat
            </Link>
            <span className="pill">
              Squad ID: {learningPath.collaboration.squadId.slice(0, 8)}
            </span>
          </div>
        </Panel>
      ) : null}

      <div className="space-y-4">
        {(learningPath?.modules ?? []).map((module) => (
          <Panel key={module.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                  Module {module.sequenceNo}
                </p>
                <h2 className="section-title text-2xl font-bold">{module.title}</h2>
                <p className="text-[var(--muted)]">{module.summary}</p>
              </div>
              <Link href={`/modules/${module.id}`} className="secondary-button">
                Open module
              </Link>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="font-semibold">Lessons</p>
                <ul className="mt-3 space-y-2 text-[var(--muted)]">
                  {module.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      {lesson.sequenceNo}. {lesson.title}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold">Tasks</p>
                <ul className="mt-3 space-y-2 text-[var(--muted)]">
                  {module.tasks.map((task) => (
                    <li key={task.id}>
                      {task.title} - {task.pointsReward} pts
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
            Project launch
          </p>
          <h2 className="section-title text-3xl font-bold">
            Convert the path into a collaborative build.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            className="field"
            placeholder="Project title"
            value={projectForm.title}
            onChange={(event) =>
              setProjectForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
          <select
            className="field"
            value={projectForm.visibility}
            onChange={(event) =>
              setProjectForm((current) => ({
                ...current,
                visibility: event.target.value,
              }))
            }
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>
        <textarea
          className="field min-h-28"
          placeholder="Project description"
          value={projectForm.description}
          onChange={(event) =>
            setProjectForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
        <button
          type="button"
          className="primary-button"
          disabled={!projectForm.title.trim() || projectMutation.isPending}
          onClick={() => projectMutation.mutate()}
        >
          Create project room
        </button>
      </Panel>
    </div>
  );
}
