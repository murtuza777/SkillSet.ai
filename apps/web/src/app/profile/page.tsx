"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
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
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    onSuccess: () => {
      setSaveMessage({ type: "success", text: "Profile updated successfully!" });
      setTimeout(() => setSaveMessage(null), 4000);
    },
    onError: () => {
      setSaveMessage({ type: "error", text: "Failed to save profile. Please try again." });
      setTimeout(() => setSaveMessage(null), 4000);
    },
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Profile"
        title="Keep your profile up to date."
        description="Your profile details help us personalize learning paths, find the best peer matches, and set the right pace for you."
        action={
          <Link href="/onboarding" className="secondary-button">
            Manage skills
          </Link>
        }
      />

      {saveMessage ? (
        <div
          className={`rounded-[20px] border p-4 text-sm ${
            saveMessage.type === "success"
              ? "border-[var(--brand)]/20 bg-[var(--brand-soft)] text-[var(--brand)]"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {saveMessage.text}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-[var(--muted)]">Display name</label>
            <input
              className="field"
              placeholder="Your name"
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({ ...current, displayName: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-[var(--muted)]">Bio</label>
            <textarea
              className="field min-h-32"
              placeholder="Tell others about yourself and your learning goals"
              value={form.bio}
              onChange={(event) =>
                setForm((current) => ({ ...current, bio: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[var(--muted)]">Timezone</label>
              <input
                className="field"
                placeholder="e.g. America/New_York"
                value={form.timezone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, timezone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[var(--muted)]">Language</label>
              <input
                className="field"
                placeholder="e.g. en"
                value={form.language}
                onChange={(event) =>
                  setForm((current) => ({ ...current, language: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[var(--muted)]">Experience level</label>
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
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[var(--muted)]">Hours per week</label>
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
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            {updateMutation.isPending ? <span className="loading-spinner" /> : <CheckCircle2 className="h-4 w-4" />}
            Save profile changes
          </button>
        </Panel>

        <Panel className="space-y-4">
          <h2 className="section-title text-3xl font-bold">Recent activity</h2>
          {activityQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <span className="loading-spinner" />
            </div>
          ) : (activityQuery.data ?? []).length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[var(--border)] p-5 text-center text-[var(--muted)]">
              Your activity will appear here as you use the platform.
            </div>
          ) : (
            <div className="space-y-3">
              {(activityQuery.data ?? []).slice(0, 10).map((event) => (
                <div
                  key={event.id}
                  className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                >
                  <p className="font-semibold">{event.eventType.replaceAll("_", " ")}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {event.entityType} · {formatDateTime(event.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
