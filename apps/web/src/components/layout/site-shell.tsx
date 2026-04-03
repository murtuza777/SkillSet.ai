"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useSessionQuery } from "@/hooks/use-session";
import { postJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const navItems: ReadonlyArray<{ href: Route; label: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/skills", label: "Skills" },
  { href: "/chat", label: "Chat" },
  { href: "/leaderboard", label: "Leaderboard" },
];

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
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="logo-mark" />
            <span>SkillSet.ai</span>
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
                <span className="hidden text-sm text-[var(--muted)] sm:inline">
                  {session.data.profile.displayName}
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={logoutMutation.isPending}
                  onClick={() => logoutMutation.mutate()}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/auth" className="primary-button">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
