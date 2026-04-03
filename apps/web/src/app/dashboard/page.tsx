"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Flame,
  MessageSquare,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest, postJson } from "@/lib/api-client";
import { formatDateTime, formatRelativePoints } from "@/lib/utils";
import type {
  AuthMe,
  GamificationOverview,
  LearningPath,
  MatchRecommendation,
  Room,
} from "@/types/domain";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      {(session) => <DashboardWorkspace session={session} />}
    </ProtectedPage>
  );
}

function DashboardWorkspace({ session }: { session: AuthMe }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const gamificationQuery = useQuery({
    queryKey: ["gamification-overview"],
    queryFn: () => apiRequest<GamificationOverview>("/gamification/me"),
  });
  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: () => apiRequest<Room[]>("/rooms"),
  });
  const matchesQuery = useQuery({
    queryKey: ["matches"],
    queryFn: () => apiRequest<MatchRecommendation[]>("/matches/recommendations"),
  });
  const activityQuery = useQuery({
    queryKey: ["activity"],
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
  const enrolledPathsQuery = useQuery({
    queryKey: ["enrolled-paths"],
    queryFn: () => apiRequest<LearningPath[]>("/learning-paths/enrolled"),
  });

  const matchMutation = useMutation({
    mutationFn: async (payload: { id: string; action: "accept" | "reject" }) =>
      postJson<{ roomId?: string | null }>(`/matches/${payload.id}/${payload.action}`),
    onSuccess: async (result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["matches"] }),
        queryClient.invalidateQueries({ queryKey: ["rooms"] }),
      ]);

      if (variables.action === "accept" && result.roomId) {
        router.push(`/chat?roomId=${result.roomId}`);
      }
    },
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Dashboard"
        title={`Welcome back, ${session.profile.displayName}.`}
        description="Here's an overview of your learning progress, rooms, and peer connections."
        action={
          <Link href="/skills" className="primary-button">
            Generate a learning path
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-4">
        <Panel className="space-y-2">
          <div className="flex items-center gap-3 text-[var(--brand)]">
            <Trophy className="h-5 w-5" />
            <p className="font-semibold">Total points</p>
          </div>
          <p className="section-title text-4xl font-bold">
            {gamificationQuery.isLoading ? <span className="loading-spinner" /> : (gamificationQuery.data?.totalPoints ?? 0)}
          </p>
          <p className="text-sm text-[var(--muted)]">
            Current level: {gamificationQuery.data?.level?.title ?? "Starter"}
          </p>
        </Panel>
        <Panel className="space-y-2">
          <div className="flex items-center gap-3 text-[var(--brand)]">
            <Flame className="h-5 w-5" />
            <p className="font-semibold">Badges earned</p>
          </div>
          <p className="section-title text-4xl font-bold">
            {gamificationQuery.isLoading ? <span className="loading-spinner" /> : (gamificationQuery.data?.badges.length ?? 0)}
          </p>
          <p className="text-sm text-[var(--muted)]">Keep learning to unlock more achievements.</p>
        </Panel>
        <Panel className="space-y-2">
          <div className="flex items-center gap-3 text-[var(--brand)]">
            <Users className="h-5 w-5" />
            <p className="font-semibold">Peer matches</p>
          </div>
          <p className="section-title text-4xl font-bold">
            {matchesQuery.isLoading ? <span className="loading-spinner" /> : (matchesQuery.data?.length ?? 0)}
          </p>
          <p className="text-sm text-[var(--muted)]">People who share your learning interests.</p>
        </Panel>
        <Panel className="space-y-2">
          <div className="flex items-center gap-3 text-[var(--brand)]">
            <MessageSquare className="h-5 w-5" />
            <p className="font-semibold">Active rooms</p>
          </div>
          <p className="section-title text-4xl font-bold">
            {roomsQuery.isLoading ? <span className="loading-spinner" /> : (roomsQuery.data?.length ?? 0)}
          </p>
          <p className="text-sm text-[var(--muted)]">Your project and peer collaboration spaces.</p>
        </Panel>
      </div>

      {/* Enrolled Learning Paths */}
      <Panel className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
              Learning paths
            </p>
            <h2 className="section-title text-3xl font-bold">Your enrolled paths</h2>
          </div>
          <Link href="/skills" className="secondary-button">
            Browse skills
          </Link>
        </div>
        {enrolledPathsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading-spinner" />
          </div>
        ) : (enrolledPathsQuery.data ?? []).length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[var(--border)] p-6 text-center text-[var(--muted)]">
            <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-50" />
            <p>You haven&apos;t enrolled in any learning paths yet.</p>
            <p className="mt-1 text-sm">Head to the Skill Explorer to generate your first path!</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(enrolledPathsQuery.data ?? []).map((path) => (
              <Link
                key={path.id}
                href={`/learning-paths/${path.id}`}
                className="block rounded-[22px] border border-[var(--border)] bg-white/80 p-4 transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{path.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {path.difficulty} · {path.estimatedHours}h · {path.modules?.length ?? 0} modules
                    </p>
                  </div>
                  {path.enrollment ? (
                    <span className="pill bg-[var(--brand-soft)] text-[var(--brand)]">
                      {path.enrollment.progressPct}%
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                Skill profile
              </p>
              <h2 className="section-title text-3xl font-bold">Current focus areas</h2>
            </div>
            <Link href="/onboarding" className="secondary-button">
              Update skills
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {(session.profile.skills ?? []).length === 0 ? (
              <p className="text-[var(--muted)]">No skills added yet. Start by updating your onboarding profile.</p>
            ) : (
              (session.profile.skills ?? []).map((skill) => (
                <span
                  key={`${skill.id}-${skill.direction}`}
                  className="pill bg-white/80 text-[var(--ink)]"
                >
                  <Sparkles className="h-4 w-4 text-[var(--brand)]" />
                  {skill.name} — {skill.direction === "have" ? "Known" : "Learning"}
                </span>
              ))
            )}
          </div>
          <p className="text-[var(--muted)]">
            Weekly availability: {session.profile.weeklyHours ?? 0} hours ·
            Timezone: {session.profile.timezone ?? "Not set"} ·
            Language: {session.profile.language ?? "Not set"}
          </p>
        </Panel>

        <Panel className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                Recommended matches
              </p>
              <h2 className="section-title text-3xl font-bold">People worth meeting</h2>
            </div>
          </div>

          {matchesQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <span className="loading-spinner" />
            </div>
          ) : (matchesQuery.data ?? []).length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[var(--border)] p-5 text-center text-[var(--muted)]">
              No matches yet — add skills to your profile to get paired with peers.
            </div>
          ) : (
            <div className="space-y-3">
              {(matchesQuery.data ?? []).slice(0, 4).map((match) => (
                <div
                  key={match.id}
                  className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{match.displayName}</p>
                      <p className="text-sm text-[var(--muted)]">
                        Score {match.score} · {match.timezone ?? "Timezone TBD"} ·{" "}
                        {match.experienceLevel ?? "Level TBD"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {match.reasons.map((reason) => (
                          <span key={reason} className="pill">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          matchMutation.mutate({ id: match.id, action: "accept" })
                        }
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          matchMutation.mutate({ id: match.id, action: "reject" })
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title text-3xl font-bold">Recent room activity</h2>
            <Link href="/chat" className="secondary-button">
              Open chat
            </Link>
          </div>

          {roomsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <span className="loading-spinner" />
            </div>
          ) : (roomsQuery.data ?? []).length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[var(--border)] p-5 text-center text-[var(--muted)]">
              No rooms yet — accept a peer match or create a project to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {(roomsQuery.data ?? []).slice(0, 5).map((room) => (
                <Link
                  key={room.id}
                  href={`/chat?roomId=${room.id}`}
                  className="block rounded-[22px] border border-[var(--border)] bg-white/80 p-4 transition hover:-translate-y-0.5"
                >
                  <p className="font-semibold">{room.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {room.roomType} · Last active {formatDateTime(room.latestMessageAt ?? room.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title text-3xl font-bold">Recent progress</h2>
            <Link href="/leaderboard" className="secondary-button">
              View leaderboard
            </Link>
          </div>

          {gamificationQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <span className="loading-spinner" />
            </div>
          ) : (gamificationQuery.data?.recentEntries ?? []).length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[var(--border)] p-5 text-center text-[var(--muted)]">
              Complete tasks and activities to start earning points!
            </div>
          ) : (
            <div className="space-y-3">
              {(gamificationQuery.data?.recentEntries ?? []).slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{entry.eventType.replaceAll("_", " ")}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                    <span className="pill bg-[var(--brand-soft)] text-[var(--brand)]">
                      {formatRelativePoints(entry.pointsDelta)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="space-y-4">
        <h2 className="section-title text-3xl font-bold">Activity log</h2>
        {activityQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <span className="loading-spinner" />
          </div>
        ) : (activityQuery.data ?? []).length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[var(--border)] p-5 text-center text-[var(--muted)]">
            Your activity will appear here as you use the platform.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(activityQuery.data ?? []).slice(0, 8).map((event) => (
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
  );
}
