"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest, patchJson, putJson } from "@/lib/api-client";
import type { Profile, Skill } from "@/types/domain";

type EditableSkill = {
  skillId: string;
  name: string;
  direction: "have" | "want";
  proficiencyLevel: string | null;
  targetLevel: string | null;
  priority: number | null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [skillSearch, setSkillSearch] = useState("");
  const deferredSkillSearch = useDeferredValue(skillSearch);

  return (
    <ProtectedPage>
      {(session) => (
        <OnboardingWorkspace
          initialProfile={session.profile}
          onDone={() => router.push("/dashboard")}
          deferredSkillSearch={deferredSkillSearch}
          skillSearch={skillSearch}
          setSkillSearch={setSkillSearch}
        />
      )}
    </ProtectedPage>
  );
}

function OnboardingWorkspace({
  initialProfile,
  onDone,
  deferredSkillSearch,
  skillSearch,
  setSkillSearch,
}: {
  initialProfile: Profile;
  onDone: () => void;
  deferredSkillSearch: string;
  skillSearch: string;
  setSkillSearch: (value: string) => void;
}) {
  const [profileForm, setProfileForm] = useState({
    displayName: initialProfile.displayName,
    bio: initialProfile.bio ?? "",
    timezone: initialProfile.timezone ?? "UTC",
    language: initialProfile.language ?? "en",
    experienceLevel: initialProfile.experienceLevel ?? "beginner",
    weeklyHours: initialProfile.weeklyHours ?? 4,
  });
  const [selectedSkills, setSelectedSkills] = useState<EditableSkill[]>(
    (initialProfile.skills ?? []).map((skill) => ({
      skillId: skill.id,
      name: skill.name,
      direction: skill.direction,
      proficiencyLevel: skill.proficiencyLevel,
      targetLevel: skill.targetLevel,
      priority: skill.priority,
    })),
  );

  const skillQuery = useQuery({
    queryKey: ["skills-search", deferredSkillSearch],
    queryFn: () =>
      deferredSkillSearch.trim()
        ? apiRequest<Skill[]>(`/skills/search?q=${encodeURIComponent(deferredSkillSearch)}`)
        : apiRequest<Skill[]>("/skills"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await patchJson("/users/me", {
        displayName: profileForm.displayName,
        bio: profileForm.bio || null,
        timezone: profileForm.timezone,
        language: profileForm.language,
        experienceLevel: profileForm.experienceLevel,
        weeklyHours: profileForm.weeklyHours,
      });

      await putJson("/users/me/skills", {
        skills: selectedSkills.map((skill, index) => ({
          skillId: skill.skillId,
          direction: skill.direction,
          proficiencyLevel: skill.proficiencyLevel,
          targetLevel: skill.targetLevel,
          priority: skill.priority ?? selectedSkills.length - index,
        })),
      });
    },
    onSuccess: onDone,
  });

  const availableSkills = useMemo(
    () =>
      (skillQuery.data ?? []).filter(
        (skill) =>
          !selectedSkills.some((selected) => selected.skillId === skill.id),
      ),
    [selectedSkills, skillQuery.data],
  );

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Onboarding"
        title="Tell us about yourself and what you want to learn."
        description="Your profile details and skill selections help us personalize your learning paths and find the best peer matches."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-5">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[var(--muted)]">Display name</label>
            <input
              className="field"
              value={profileForm.displayName}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[var(--muted)]">Bio</label>
            <textarea
              className="field min-h-32"
              value={profileForm.bio}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  bio: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-[var(--muted)]">Timezone</label>
              <input
                className="field"
                value={profileForm.timezone}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-semibold text-[var(--muted)]">Language</label>
              <input
                className="field"
                value={profileForm.language}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    language: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-[var(--muted)]">Experience level</label>
              <select
                className="field"
                value={profileForm.experienceLevel}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    experienceLevel: event.target.value,
                  }))
                }
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-semibold text-[var(--muted)]">Hours per week</label>
              <input
                className="field"
                min={1}
                max={80}
                type="number"
                value={profileForm.weeklyHours}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    weeklyHours: Number(event.target.value),
                  }))
                }
              />
            </div>
          </div>
        </Panel>

        <Panel className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                Skills inventory
              </p>
              <h2 className="section-title text-3xl font-bold">What you have and what you want</h2>
            </div>
            <span className="pill">
              <Sparkles className="h-4 w-4" />
              {selectedSkills.length} selected
            </span>
          </div>

          <input
            className="field"
            placeholder="Search skills to add"
            value={skillSearch}
            onChange={(event) => setSkillSearch(event.target.value)}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="font-semibold">Available skills</p>
              <div className="space-y-3">
                {availableSkills.slice(0, 8).map((skill) => (
                  <div
                    key={skill.id}
                    className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{skill.name}</p>
                        <p className="text-sm text-[var(--muted)]">{skill.description}</p>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setSelectedSkills((current) => [
                            ...current,
                            {
                              skillId: skill.id,
                              name: skill.name,
                              direction: "want",
                              proficiencyLevel: "beginner",
                              targetLevel: "intermediate",
                              priority: current.length + 1,
                            },
                          ])
                        }
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-semibold">Selected skills</p>
              <div className="space-y-3">
                {selectedSkills.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-[var(--border)] p-5 text-[var(--muted)]">
                    Add at least one skill you want to learn or already have.
                  </div>
                ) : null}

                {selectedSkills.map((skill, index) => (
                  <div
                    key={`${skill.skillId}-${index}`}
                    className="space-y-3 rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{skill.name}</p>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setSelectedSkills((current) =>
                            current.filter((entry, entryIndex) => entryIndex !== index),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <select
                        className="field"
                        value={skill.direction}
                        onChange={(event) =>
                          setSelectedSkills((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    direction: event.target.value as "have" | "want",
                                  }
                                : entry,
                            ),
                          )
                        }
                      >
                        <option value="have">Already have</option>
                        <option value="want">Want to learn</option>
                      </select>
                      <select
                        className="field"
                        value={skill.proficiencyLevel ?? ""}
                        onChange={(event) =>
                          setSelectedSkills((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    proficiencyLevel: event.target.value || null,
                                  }
                                : entry,
                            ),
                          )
                        }
                      >
                        <option value="">Proficiency</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                      <select
                        className="field"
                        value={skill.targetLevel ?? ""}
                        onChange={(event) =>
                          setSelectedSkills((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    targetLevel: event.target.value || null,
                                  }
                                : entry,
                            ),
                          )
                        }
                      >
                        <option value="">Target level</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="primary-button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? <span className="loading-spinner" /> : <CheckCircle2 className="h-4 w-4" />}
            Save onboarding and continue
          </button>
          {saveMutation.isError ? (
            <div className="rounded-[20px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Failed to save. Please try again.
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
