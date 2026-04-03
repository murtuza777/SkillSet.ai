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

import { GlobeInteractive } from "@/components/ui/cobe-globe-interactive";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";

const features = [
  {
    icon: SearchCheck,
    title: "Learn from the best sources",
    description:
      "SkillSet.ai curates docs, videos, and tutorials from across the web so you always learn from high-quality, relevant material.",
  },
  {
    icon: BrainCircuit,
    title: "AI-personalized learning paths",
    description:
      "Get structured modules, lessons, and hands-on tasks tailored to your skill level, goals, and available time.",
  },
  {
    icon: Users2,
    title: "Find your learning partners",
    description:
      "Get matched with peers who share your interests, then collaborate in shared rooms and build projects together.",
  },
  {
    icon: Trophy,
    title: "Stay motivated with real progress",
    description:
      "Track points, earn badges, maintain streaks, and climb leaderboards — all while building real skills.",
  },
];

const highlights = [
  "AI-powered learning paths",
  "Real-time collaboration rooms",
  "Smart peer matching",
  "Guest-friendly — no signup required",
];

export default function Home() {
  return (
    <div className="space-y-8 pb-10">
      <section className="hero-mesh glass-card relative overflow-hidden rounded-[40px] border border-[var(--border)] px-6 py-14 sm:px-10 sm:py-18">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[540px] w-[540px] max-w-[95%] sm:h-[680px] sm:w-[680px]">
            <GlobeInteractive className="h-full w-full" speed={0.0025} />
          </div>
        </div>
        {/* Light vignette only at edges so the globe stays crisp and readable in the center */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 75% at 50% 48%, transparent 0%, transparent 42%, rgba(233, 239, 255, 0.45) 72%, rgba(243, 246, 251, 0.88) 100%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center space-y-8 text-center">
          <span className="pill pointer-events-auto bg-[var(--brand-soft)] text-[var(--brand)]">
            <Sparkles className="h-4 w-4" />
            AI-powered collaborative learning
          </span>
          <div className="space-y-4">
            <h1 className="section-title mx-auto max-w-4xl text-5xl font-bold leading-[0.94] tracking-[-0.06em] sm:text-6xl">
              Learn a skill, meet the right peers, and ship projects with momentum.
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-[var(--muted)]">
              SkillSet.ai combines AI-personalized learning paths, smart content
              discovery, project rooms, peer matching, and gamified progress -
              all in one platform.
            </p>
          </div>
          <div className="pointer-events-auto flex flex-col gap-3 sm:flex-row">
            <Link href="/auth" className="primary-button">
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/skills" className="secondary-button">
              Explore the skill catalog
            </Link>
          </div>
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
            {highlights.map((highlight) => (
              <span key={highlight} className="pill">
                {highlight}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section>
        <Panel className="space-y-5 bg-[rgba(255,255,255,0.82)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                How it works
              </p>
              <h2 className="section-title text-2xl font-bold">
                One platform, multiple learning loops
              </h2>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-4">
              <p className="text-sm font-semibold text-[var(--brand)]">
                Personalized paths
              </p>
              <p className="mt-2 text-[var(--muted)]">
                Tell us your goal and we&apos;ll generate a structured learning
                path with modules, lessons, and tasks pulled from the best
                sources.
              </p>
            </div>
            <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-4">
              <p className="text-sm font-semibold text-[var(--brand)]">
                Realtime collaboration
              </p>
              <p className="mt-2 text-[var(--muted)]">
                Join project rooms, chat with learning partners, and build
                together in real time without leaving the platform.
              </p>
            </div>
            <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-4">
              <p className="text-sm font-semibold text-[var(--brand)]">
                Motivation that works
              </p>
              <p className="mt-2 text-[var(--muted)]">
                Earn points, unlock badges, and track your level progression so
                you always see how far you&apos;ve come.
              </p>
            </div>
          </div>
        </Panel>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Built for the full loop"
          title="From first skill pick to project room"
          description="SkillSet.ai covers the entire journey: onboarding, content discovery, path generation, task submission, peer matching, chat, and community leaderboards."
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
            Jump into project rooms or matched peer rooms with real-time
            presence and instant message delivery.
          </p>
        </Panel>
        <Panel className="space-y-4">
          <div className="flex items-center gap-3">
            <Rocket className="h-5 w-5 text-[var(--brand)]" />
            <p className="font-semibold">Built for speed</p>
          </div>
          <p className="text-[var(--muted)]">
            The platform is optimized for fast load times and
            instant interactions so your learning flow is never interrupted.
          </p>
        </Panel>
        <Panel className="space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[var(--brand)]" />
            <p className="font-semibold">Try it instantly</p>
          </div>
          <p className="text-[var(--muted)]">
            Continue as a guest to explore learning paths, rooms,
            and the dashboard without creating an account — zero friction.
          </p>
        </Panel>
      </section>
    </div>
  );
}
