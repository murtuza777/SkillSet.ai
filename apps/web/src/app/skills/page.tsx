"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest, postJson } from "@/lib/api-client";
import type { ContentDiscovery, LearningPath, Skill } from "@/types/domain";

export default function SkillsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [goalType, setGoalType] = useState("portfolio");
  const [difficulty, setDifficulty] = useState("beginner");
  const deferredSearch = useDeferredValue(search);

  const skillsQuery = useQuery({
    queryKey: ["skills", deferredSearch],
    queryFn: () =>
      deferredSearch.trim()
        ? apiRequest<Skill[]>(`/skills/search?q=${encodeURIComponent(deferredSearch)}`)
        : apiRequest<Skill[]>("/skills"),
  });

  const selectedSkill = useMemo(
    () => (skillsQuery.data ?? []).find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedSkillId, skillsQuery.data],
  );

  const discoverMutation = useMutation({
    mutationFn: () =>
      postJson<ContentDiscovery>("/content/discover", {
        skillId: selectedSkillId,
        goal: goalType,
        level: difficulty,
      }),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      postJson<LearningPath>("/learning-paths/generate", {
        skillId: selectedSkillId,
        goalType,
        difficulty,
        preferredContentType: "mixed",
      }),
    onSuccess: (path) => router.push(`/learning-paths/${path.id}`),
  });

  return (
    <ProtectedPage>
      {() => (
        <div className="space-y-6">
          <SectionHeading
            eyebrow="Skill explorer"
            title="Discover a skill, inspect the content mix, then generate the path."
            description="This page ties together the skill taxonomy, content discovery, and Workers AI learning-path generation flow from impl.md."
          />

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Panel className="space-y-5">
              <div className="flex items-center gap-3">
                <Compass className="h-5 w-5 text-[var(--brand)]" />
                <p className="font-semibold">Choose your next skill</p>
              </div>

              <label className="relative block">
                <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  className="field pl-11"
                  placeholder="Search Python, React, TypeScript..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="space-y-3">
                {(skillsQuery.data ?? []).map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className={`w-full rounded-[22px] border p-4 text-left transition ${
                      selectedSkillId === skill.id
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-[var(--border)] bg-white/80"
                    }`}
                    onClick={() => setSelectedSkillId(skill.id)}
                  >
                    <p className="font-semibold">{skill.name}</p>
                    <p className="text-sm text-[var(--muted)]">{skill.description}</p>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  className="field"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <input
                  className="field"
                  value={goalType}
                  onChange={(event) => setGoalType(event.target.value)}
                  placeholder="Goal type"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!selectedSkillId || discoverMutation.isPending}
                  onClick={() => discoverMutation.mutate()}
                >
                  Discover content
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!selectedSkillId || generateMutation.isPending}
                  onClick={() => generateMutation.mutate()}
                >
                  Generate path
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </Panel>

            <Panel className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                  Discovery preview
                </p>
                <h2 className="section-title text-3xl font-bold">
                  {selectedSkill?.name ?? "Select a skill"} content mix
                </h2>
              </div>

              {discoverMutation.data?.sources?.length ? (
                <div className="space-y-3">
                  {discoverMutation.data.sources.map((source) => (
                    <div
                      key={source.id}
                      className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{source.title}</p>
                          <p className="text-sm text-[var(--muted)]">
                            {source.provider} - {source.sourceType} - quality {source.qualityScore}
                          </p>
                        </div>
                        <a
                          href={source.canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary-button"
                        >
                          Open source
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-[var(--border)] p-6 text-[var(--muted)]">
                  Discover content to inspect which docs and videos the backend finds for the selected skill.
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}
