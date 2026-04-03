"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { use, useState } from "react";

import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest, postJson } from "@/lib/api-client";
import type { LearningModule, TaskAttempt } from "@/types/domain";

export default function ModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ProtectedPage>
      {() => <ModuleWorkspace params={params} />}
    </ProtectedPage>
  );
}

function ModuleWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [submissions, setSubmissions] = useState<Record<string, { text: string; url: string }>>({});

  const moduleQuery = useQuery({
    queryKey: ["module", id],
    queryFn: () => apiRequest<LearningModule>(`/modules/${id}`),
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { taskId: string; submissionText?: string; submissionUrl?: string }) =>
      postJson<TaskAttempt>(`/tasks/${payload.taskId}/submit`, payload),
  });

  const moduleData = moduleQuery.data;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Module view"
        title={moduleData?.title ?? "Loading module..."}
        description={moduleData?.summary ?? "Review lessons, open source material, and submit tasks."}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-4">
          <h2 className="section-title text-3xl font-bold">Lessons</h2>
          {(moduleData?.lessons ?? []).map((lesson) => (
            <div
              key={lesson.id}
              className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
            >
              <p className="font-semibold">{lesson.title}</p>
              <p className="mt-2 text-[var(--muted)]">{lesson.summary}</p>
              <div className="mt-3 space-y-2">
                {lesson.contentRef.map((content) => (
                  <a
                    key={`${lesson.id}-${content.sourceId}`}
                    href={content.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary-button"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {content.title}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </Panel>

        <Panel className="space-y-4">
          <h2 className="section-title text-3xl font-bold">Tasks</h2>
          {(moduleData?.tasks ?? []).map((task) => {
            const submission = submissions[task.id] ?? { text: "", url: "" };

            return (
              <div
                key={task.id}
                className="space-y-4 rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
              >
                <div>
                  <p className="font-semibold">{task.title}</p>
                  <p className="mt-2 text-[var(--muted)]">{task.instructions}</p>
                </div>
                <ul className="space-y-1 text-sm text-[var(--muted)]">
                  {task.acceptanceCriteria.map((criterion) => (
                    <li key={criterion}>- {criterion}</li>
                  ))}
                </ul>
                <textarea
                  className="field min-h-28"
                  placeholder="Submission notes"
                  value={submission.text}
                  onChange={(event) =>
                    setSubmissions((current) => ({
                      ...current,
                      [task.id]: {
                        ...submission,
                        text: event.target.value,
                      },
                    }))
                  }
                />
                <input
                  className="field"
                  placeholder="Optional submission URL"
                  value={submission.url}
                  onChange={(event) =>
                    setSubmissions((current) => ({
                      ...current,
                      [task.id]: {
                        ...submission,
                        url: event.target.value,
                      },
                    }))
                  }
                />
                <button
                  type="button"
                  className="primary-button"
                  disabled={submitMutation.isPending}
                  onClick={() =>
                    submitMutation.mutate({
                      taskId: task.id,
                      submissionText: submission.text || undefined,
                      submissionUrl: submission.url || undefined,
                    })
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Submit task
                </button>
                {submitMutation.data?.taskId === task.id ? (
                  <div className="rounded-[20px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] p-4 text-sm text-[var(--brand)]">
                    {submitMutation.data.feedback.summary}
                  </div>
                ) : null}
              </div>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}
