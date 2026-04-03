import {
  ArrowRight,
  BrainCircuit,
  Gauge,
  MessageSquareMore,
  Rocket,
  SearchCheck,
  Sparkles,
  Trophy,
  Users2,
} from "lucide-react";
import Link from "next/link";

import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";

const features = [
  {
    icon: SearchCheck,
    title: "Content discovery grounded in real sources",
    description:
      "SkillSet.ai combines curated docs, YouTube discovery, embeddings, and search to build paths from actual learning material.",
  },
  {
    icon: BrainCircuit,
    title: "Workers AI learning-path generation",
    description:
      "Generate structured modules, lessons, and tasks that adapt to skill, goal, pace, and current level.",
  },
  {
    icon: Users2,
    title: "Peer matching and collaborative rooms",
    description:
      "Find aligned learners, spin up shared rooms, and move naturally from solo study into project collaboration.",
  },
  {
    icon: Trophy,
    title: "Progress that feels motivating",
    description:
      "Track points, badges, streaks, leaderboards, and project completions without losing sight of actual skill growth.",
  },
];

const highlights = [
  "Cloudflare Workers API with Hono",
  "D1, KV, R2, Vectorize, Durable Objects, Queues",
  "Next.js App Router frontend on Cloudflare",
  "Guest sessions plus email/password auth",
];

export default function Home() {
  return (
    <div className="space-y-8 pb-10">
      <section className="hero-mesh glass-card overflow-hidden rounded-[40px] border border-[var(--border)] px-6 py-10 sm:px-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-7">
            <span className="pill bg-[var(--brand-soft)] text-[var(--brand)]">
              <Sparkles className="h-4 w-4" />
              Cloudflare-native collaborative learning
            </span>
            <div className="space-y-4">
              <h1 className="section-title max-w-4xl text-5xl font-bold leading-[0.94] tracking-[-0.06em] sm:text-6xl">
                Learn a skill, meet the right peers, and ship projects with momentum.
              </h1>
              <p className="max-w-2xl text-xl text-[var(--muted)]">
                SkillSet.ai brings together AI-generated learning paths, semantic
                content discovery, project rooms, peer matching, and gamified
                progress in one Cloudflare-native stack.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/auth" className="primary-button">
                Launch your workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/skills" className="secondary-button">
                Explore the skill catalog
              </Link>
            </div>
            <div className="flex flex-wrap gap-3">
              {highlights.map((highlight) => (
                <span key={highlight} className="pill">
                  {highlight}
                </span>
              ))}
            </div>
          </div>

          <Panel className="space-y-5 bg-[rgba(255,255,255,0.82)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  What the stack unlocks
                </p>
                <h2 className="section-title text-2xl font-bold">
                  One system, multiple learning loops
                </h2>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-4">
                <p className="text-sm font-semibold text-[var(--brand)]">Path generation</p>
                <p className="mt-2 text-[var(--muted)]">
                  Turn a skill goal into modules, lessons, and tasks using Workers AI plus Vectorize-backed source retrieval.
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-4">
                <p className="text-sm font-semibold text-[var(--brand)]">Realtime collaboration</p>
                <p className="mt-2 text-[var(--muted)]">
                  Use Durable Objects for room coordination, chat, presence, and project momentum without leaving the platform.
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-4">
                <p className="text-sm font-semibold text-[var(--brand)]">Motivation loop</p>
                <p className="mt-2 text-[var(--muted)]">
                  Track points, badges, and level progression so learners always see what meaningful progress looks like.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Built for the full loop"
          title="From first skill pick to project room"
          description="The MVP flows in this repo cover the entire cycle: onboarding, content discovery, path generation, task submission, matching, chat, and admin curation."
        />
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Panel key={feature.title} className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="section-title text-2xl font-bold">{feature.title}</h3>
                  <p className="text-[var(--muted)]">{feature.description}</p>
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
        <Panel className="space-y-4">
          <div className="flex items-center gap-3">
            <MessageSquareMore className="h-5 w-5 text-[var(--brand)]" />
            <p className="font-semibold">Chat-first collaboration</p>
          </div>
          <p className="text-[var(--muted)]">
            Jump into project rooms or matched peer rooms with realtime presence
            and WebSocket-backed message delivery.
          </p>
        </Panel>
        <Panel className="space-y-4">
          <div className="flex items-center gap-3">
            <Rocket className="h-5 w-5 text-[var(--brand)]" />
            <p className="font-semibold">Production-minded deployment</p>
          </div>
          <p className="text-[var(--muted)]">
            API and frontend are ready for Cloudflare deployment with OpenNext,
            Wrangler, D1, KV, R2, Vectorize, and GitHub Actions.
          </p>
        </Panel>
        <Panel className="space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[var(--brand)]" />
            <p className="font-semibold">Guest-friendly onboarding</p>
          </div>
          <p className="text-[var(--muted)]">
            Prospective learners can continue as guests before committing to an
            email account, so the first session has almost zero friction.
          </p>
        </Panel>
      </section>
    </div>
  );
}
