"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { BrandLogo } from "@/components/ui/brand-logo";
import { useSessionQuery } from "@/hooks/use-session";
import { postJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const navItems: ReadonlyArray<{ href: Route; label: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/skills", label: "Skills" },
  { href: "/chat", label: "Chat" },
  { href: "/leaderboard", label: "Leaderboard" },
];

type SessionData = NonNullable<ReturnType<typeof useSessionQuery>["data"]>;

function MobileNavDrawer({
  pathname,
  session,
  logoutPending,
  onLogout,
}: {
  pathname: string;
  session: SessionData | undefined;
  logoutPending: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--ink)] md:hidden"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full border-t border-[var(--border)] bg-white/95 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-3 text-sm font-medium",
                  pathname.startsWith(item.href)
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--muted)]",
                )}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {session ? (
            <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
              <p className="px-3 text-sm text-[var(--muted)]">
                {session.profile.displayName}
              </p>
              <button
                type="button"
                className="secondary-button w-full justify-center"
                disabled={logoutPending}
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function SiteShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const session = useSessionQuery();

  const logoutMutation = useMutation({
    mutationFn: () => postJson<{ loggedOut: boolean }>("/auth/logout"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      router.push("/auth");
    },
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/80 backdrop-blur">
        <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 font-semibold tracking-tight"
          >
            <BrandLogo size={36} className="size-8 sm:size-9" priority />
            <span className="truncate">SkillSet.ai</span>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  pathname.startsWith(item.href)
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--muted)] hover:bg-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {session.data ? (
              <>
                <span className="hidden max-w-[10rem] truncate text-sm text-[var(--muted)] lg:inline">
                  {session.data.profile.displayName}
                </span>
                <button
                  type="button"
                  className="secondary-button hidden sm:inline-flex"
                  disabled={logoutMutation.isPending}
                  onClick={() => logoutMutation.mutate()}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/auth" className="primary-button text-sm">
                Login
              </Link>
            )}

            <MobileNavDrawer
              key={pathname}
              pathname={pathname}
              session={session.data}
              logoutPending={logoutMutation.isPending}
              onLogout={() => logoutMutation.mutate()}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
