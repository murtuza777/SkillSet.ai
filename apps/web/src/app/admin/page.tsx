"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest, postJson } from "@/lib/api-client";
import type { AdminMetrics, Skill } from "@/types/domain";

export default function AdminPage() {
  return (
    <ProtectedPage roles={["admin"]}>
      {() => <AdminWorkspace />}
    </ProtectedPage>
  );
}

function AdminWorkspace() {
  const [contentForm, setContentForm] = useState({
    provider: "manual",
    sourceType: "doc",
    canonicalUrl: "",
    title: "",
    language: "en",
  });
  const [badgeForm, setBadgeForm] = useState({
    code: "",
    name: "",
    description: "",
  });
  const [selectedSkillId, setSelectedSkillId] = useState("");

  const metricsQuery = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => apiRequest<AdminMetrics>("/admin/metrics"),
  });
  const skillsQuery = useQuery({
    queryKey: ["admin-skills"],
    queryFn: () => apiRequest<Skill[]>("/skills"),
  });

  const addContentMutation = useMutation({
    mutationFn: () => postJson("/admin/content-sources", contentForm),
    onSuccess: () =>
      setContentForm({
        provider: "manual",
        sourceType: "doc",
        canonicalUrl: "",
        title: "",
        language: "en",
      }),
  });

  const addBadgeMutation = useMutation({
    mutationFn: () =>
      postJson("/admin/badges", {
        ...badgeForm,
        ruleJson: {
          event: "task_completed",
          count: 1,
        },
      }),
  });

  const reindexMutation = useMutation({
    mutationFn: () =>
      postJson("/admin/reindex-skill", {
        skillId: selectedSkillId,
      }),
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Admin"
        title="Curate sources, badges, and system health."
        description="Manage content sources, create badge definitions, trigger skill re-indexing, and monitor platform metrics."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {Object.entries(metricsQuery.data ?? {}).map(([key, value]) => (
          <Panel key={key} className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
              {key.replace(/([A-Z])/g, " $1")}
            </p>
            <p className="section-title text-4xl font-bold">{value}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel className="space-y-4">
          <h2 className="section-title text-2xl font-bold">Add content source</h2>
          <input
            className="field"
            placeholder="Provider"
            value={contentForm.provider}
            onChange={(event) =>
              setContentForm((current) => ({ ...current, provider: event.target.value }))
            }
          />
          <input
            className="field"
            placeholder="Source type"
            value={contentForm.sourceType}
            onChange={(event) =>
              setContentForm((current) => ({ ...current, sourceType: event.target.value }))
            }
          />
          <input
            className="field"
            placeholder="Canonical URL"
            value={contentForm.canonicalUrl}
            onChange={(event) =>
              setContentForm((current) => ({ ...current, canonicalUrl: event.target.value }))
            }
          />
          <input
            className="field"
            placeholder="Title"
            value={contentForm.title}
            onChange={(event) =>
              setContentForm((current) => ({ ...current, title: event.target.value }))
            }
          />
          <button
            type="button"
            className="primary-button"
            onClick={() => addContentMutation.mutate()}
          >
            Create source and queue ingestion
          </button>
        </Panel>

        <Panel className="space-y-4">
          <h2 className="section-title text-2xl font-bold">Add badge definition</h2>
          <input
            className="field"
            placeholder="Badge code"
            value={badgeForm.code}
            onChange={(event) =>
              setBadgeForm((current) => ({ ...current, code: event.target.value }))
            }
          />
          <input
            className="field"
            placeholder="Badge name"
            value={badgeForm.name}
            onChange={(event) =>
              setBadgeForm((current) => ({ ...current, name: event.target.value }))
            }
          />
          <textarea
            className="field min-h-28"
            placeholder="Description"
            value={badgeForm.description}
            onChange={(event) =>
              setBadgeForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => addBadgeMutation.mutate()}
          >
            Create badge
          </button>
        </Panel>

        <Panel className="space-y-4">
          <h2 className="section-title text-2xl font-bold">Reindex a skill</h2>
          <select
            className="field"
            value={selectedSkillId}
            onChange={(event) => setSelectedSkillId(event.target.value)}
          >
            <option value="">Choose a skill</option>
            {(skillsQuery.data ?? []).map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="primary-button"
            onClick={() => reindexMutation.mutate()}
          >
            Queue reindex
          </button>
        </Panel>
      </div>
    </div>
  );
}
