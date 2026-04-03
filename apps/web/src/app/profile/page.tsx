"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest, patchJson } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

export default function ProfilePage() {
  return (
    <ProtectedPage>
      {(session) => <ProfileWorkspace initialProfile={session.profile} />}
    </ProtectedPage>
  );
}

function ProfileWorkspace({
  initialProfile,
}: {
  initialProfile: {
    displayName: string;
    bio: string | null;
    timezone: string | null;
    language: string | null;
    experienceLevel: string | null;
    weeklyHours: number | null;
  };
}) {
  const [form, setForm] = useState({
    displayName: initialProfile.displayName,
    bio: initialProfile.bio ?? "",
    timezone: initialProfile.timezone ?? "UTC",
    language: initialProfile.language ?? "en",
    experienceLevel: initialProfile.experienceLevel ?? "beginner",
    weeklyHours: initialProfile.weeklyHours ?? 4,
  });

  const activityQuery = useQuery({
    queryKey: ["profile-activity"],
    queryFn: () =>
      apiRequest<
        Array<{
          id: string;
          eventType: string;
          entityType: string;
          entityId: string | null;
          createdAt: string;
        }>
      >("/users/me/activity"),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      patchJson("/users/me", {
        displayName: form.displayName,
        bio: form.bio || null,
        timezone: form.timezone,
        language: form.language,
        experienceLevel: form.experienceLevel,
        weeklyHours: form.weeklyHours,
      }),
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Profile"
        title="Keep your collaboration context fresh."
        description="Profile details feed matching, pacing, and path generation. Skills are managed from onboarding so the taxonomy stays consistent."
        action={
          <Link href="/onboarding" className="secondary-button">
            Manage skills in onboarding
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-4">
          <input
            className="field"
            value={form.displayName}
            onChange={(event) =>
              setForm((current) => ({ ...current, displayName: event.target.value }))
            }
          />
          <textarea
            className="field min-h-32"
            value={form.bio}
            onChange={(event) =>
              setForm((current) => ({ ...current, bio: event.target.value }))
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className="field"
              value={form.timezone}
              onChange={(event) =>
                setForm((current) => ({ ...current, timezone: event.target.value }))
              }
            />
            <input
              className="field"
              value={form.language}
              onChange={(event) =>
                setForm((current) => ({ ...current, language: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <select
              className="field"
              value={form.experienceLevel}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  experienceLevel: event.target.value,
                }))
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <input
              className="field"
              min={1}
              max={80}
              type="number"
              value={form.weeklyHours}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  weeklyHours: Number(event.target.value),
                }))
              }
            />
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            Save profile changes
          </button>
        </Panel>

        <Panel className="space-y-4">
          <h2 className="section-title text-3xl font-bold">Recent activity</h2>
          <div className="space-y-3">
            {(activityQuery.data ?? []).slice(0, 10).map((event) => (
              <div
                key={event.id}
                className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
              >
                <p className="font-semibold">{event.eventType.replaceAll("_", " ")}</p>
                <p className="text-sm text-[var(--muted)]">
                  {event.entityType} - {formatDateTime(event.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
