"use client";

import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { useState } from "react";

import { ProtectedPage } from "@/components/layout/protected-page";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiRequest } from "@/lib/api-client";
import { useUiStore } from "@/stores/ui-store";
import type { Leaderboard, Skill } from "@/types/domain";

export default function LeaderboardPage() {
  return (
    <ProtectedPage>
      {() => <LeaderboardWorkspace />}
    </ProtectedPage>
  );
}

function LeaderboardWorkspace() {
  const selectedSkillScope = useUiStore((state) => state.selectedSkillScope);
  const setSelectedSkillScope = useUiStore((state) => state.setSelectedSkillScope);
  const [scopeType, setScopeType] = useState("global");
  const [periodType, setPeriodType] = useState("all_time");

  const skillsQuery = useQuery({
    queryKey: ["leaderboard-skills"],
    queryFn: () => apiRequest<Skill[]>("/skills"),
  });

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", scopeType, selectedSkillScope, periodType],
    queryFn: () =>
      apiRequest<Leaderboard>(
        `/leaderboards${scopeType === "global" ? "" : `/${scopeType}`}?periodType=${periodType}${scopeType === "skill" && selectedSkillScope ? `&scopeId=${selectedSkillScope}` : ""}`,
      ),
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Leaderboard"
        title="See how consistent learning stacks up."
        description="Compare your progress with other learners — filter by global ranking or by specific skill."
      />

      <Panel className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <select
            className="field"
            value={scopeType}
            onChange={(event) => setScopeType(event.target.value)}
          >
            <option value="global">Global</option>
            <option value="skill">Per skill</option>
          </select>
          <select
            className="field"
            value={selectedSkillScope}
            disabled={scopeType !== "skill"}
            onChange={(event) => setSelectedSkillScope(event.target.value)}
          >
            <option value="">Choose a skill</option>
            {(skillsQuery.data ?? []).map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={periodType}
            onChange={(event) => setPeriodType(event.target.value)}
          >
            <option value="all_time">All time</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div className="space-y-3">
          {(leaderboardQuery.data?.rankings ?? []).map((entry) => (
            <div
              key={entry.userId}
              className="flex items-center justify-between gap-4 rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">
                    #{entry.rank} {entry.displayName}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{entry.totalPoints} points earned</p>
                </div>
              </div>
              <span className="pill bg-[var(--brand-soft)] text-[var(--brand)]">
                {entry.totalPoints} pts
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
