"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, MailCheck, Rocket, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { ApiError, postJson } from "@/lib/api-client";
import type { SessionUser } from "@/types/domain";

type AuthMode = "login" | "register" | "verify";

interface RegisterResponse {
  user: SessionUser;
  verificationToken: string;
}

export default function AuthPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState("");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    displayName: "",
    timezone: "UTC",
    language: "en",
    experienceLevel: "beginner",
    weeklyHours: 4,
  });
  const [verifyForm, setVerifyForm] = useState({ email: "", token: "" });

  const authMutation = useMutation({
    mutationFn: async (payload: { path: string; body?: unknown }) =>
      postJson<{ user: SessionUser } | RegisterResponse>(payload.path, payload.body),
    onSuccess: async (data, variables) => {
      if (variables.path === "/auth/register") {
        const typed = data as RegisterResponse;
        setVerificationToken(typed.verificationToken);
        setVerifyForm({ email: typed.user.email, token: typed.verificationToken });
        setMessage(
          "Account created. A verification token has been generated so you can complete email verification from the UI.",
        );
        setMode("verify");
        return;
      }

      if (variables.path === "/auth/verify-email") {
        setMessage("Email verified. You can log in now.");
        setMode("login");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["session"] });
      router.push("/dashboard");
    },
    onError: (error) => {
      setMessage(error instanceof ApiError ? error.message : "Unable to continue.");
    },
  });

  const tabs = useMemo(
    () =>
      [
        { key: "login", label: "Login" },
        { key: "register", label: "Register" },
        { key: "verify", label: "Verify email" },
      ] satisfies Array<{ key: AuthMode; label: string }>,
    [],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel className="hero-mesh space-y-6">
        <SectionHeading
          eyebrow="Authentication"
          title="Enter the workspace on your terms."
          description="Use email/password for a persistent account or continue as a guest for a temporary session backed by the Cloudflare Worker auth flow."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[var(--brand-soft)] p-3 text-[var(--brand)]">
                <MailCheck className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Verified accounts</h3>
            </div>
            <p className="mt-3 text-[var(--muted)]">
              Register with email, verify through the Worker API, and keep your
              paths, projects, badges, and matching history over time.
            </p>
          </div>
          <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]">
                <Rocket className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Guest sessions</h3>
            </div>
            <p className="mt-3 text-[var(--muted)]">
              Continue as a guest to explore onboarding, learning paths, rooms,
              and the dashboard without creating a full account yet.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={authMutation.isPending}
          onClick={() => authMutation.mutate({ path: "/auth/guest" })}
        >
          <UserRoundPlus className="h-4 w-4" />
          Continue as Guest
        </button>
      </Panel>

      <Panel className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                mode === tab.key ? "primary-button" : "secondary-button"
              }
              onClick={() => setMode(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {message ? (
          <div className="rounded-[20px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] p-4 text-sm text-[var(--brand)]">
            {message}
          </div>
        ) : null}

        {mode === "login" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              authMutation.mutate({ path: "/auth/login", body: loginForm });
            }}
          >
            <input
              className="field"
              placeholder="Email"
              type="email"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
            <input
              className="field"
              placeholder="Password"
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
            <button type="submit" className="primary-button w-full" disabled={authMutation.isPending}>
              Login
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : null}

        {mode === "register" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              authMutation.mutate({ path: "/auth/register", body: registerForm });
            }}
          >
            <input
              className="field"
              placeholder="Display name"
              value={registerForm.displayName}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
            />
            <input
              className="field"
              placeholder="Email"
              type="email"
              value={registerForm.email}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
            <input
              className="field"
              placeholder="Password"
              type="password"
              value={registerForm.password}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <select
                className="field"
                value={registerForm.experienceLevel}
                onChange={(event) =>
                  setRegisterForm((current) => ({
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
                value={registerForm.weeklyHours}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    weeklyHours: Number(event.target.value),
                  }))
                }
              />
            </div>
            <button type="submit" className="primary-button w-full" disabled={authMutation.isPending}>
              Create account
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : null}

        {mode === "verify" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              authMutation.mutate({ path: "/auth/verify-email", body: verifyForm });
            }}
          >
            <input
              className="field"
              placeholder="Email"
              type="email"
              value={verifyForm.email}
              onChange={(event) =>
                setVerifyForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
            <input
              className="field"
              placeholder="Verification token"
              value={verifyForm.token}
              onChange={(event) =>
                setVerifyForm((current) => ({
                  ...current,
                  token: event.target.value,
                }))
              }
            />
            {verificationToken ? (
              <p className="text-sm text-[var(--muted)]">
                Latest generated token: <span className="font-semibold">{verificationToken}</span>
              </p>
            ) : null}
            <button type="submit" className="primary-button w-full" disabled={authMutation.isPending}>
              Verify email
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : null}
      </Panel>
    </div>
  );
}
