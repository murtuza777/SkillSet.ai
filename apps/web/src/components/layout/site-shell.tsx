"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  LogOut,
  Menu,
  Sparkles,
  UserCircle2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { postJson } from "@/lib/api-client";
import { primaryNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useSessionQuery } from "@/hooks/use-session";
import { useUiStore } from "@/stores/ui-store";

export function SiteShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSessionQuery();
  const mobileMenuOpen = useUiStore((state) => state.mobileMenuOpen);
  const toggleMobileMenu = useUiStore((state) => state.toggleMobileMenu);
  const closeMobileMenu = useUiStore((state) => state.closeMobileMenu);

  const logoutMutation = useMutation({
    mutationFn: () => postJson("/auth/logout"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      router.push("/auth");
    },
  });

  const isPublicLanding = pathname === "/";

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[rgba(255,249,240,0.84)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 text-[0.95rem] font-bold tracking-[0.18em] text-[var(--muted)] uppercase"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand)]/12 text-[var(--brand)]">
              <Sparkles className="h-5 w-5" />
            </span>
            SkillSet.ai
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {primaryNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  pathname.startsWith(item.href)
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--muted)] hover:bg-white/70 hover:text-[var(--ink)]",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {session.data?.user ? (
              <>
                <div className="pill">
                  <UserCircle2 className="h-4 w-4" />
                  {session.data.profile.displayName}
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <Link href={isPublicLanding ? "/auth" : "/auth"} className="primary-button">
                Start learning
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          <button
            type="button"
            className="secondary-button lg:hidden"
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-[var(--border)] bg-[rgba(255,249,240,0.98)] px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-2">
              {primaryNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl px-4 py-3 font-semibold text-[var(--muted)] hover:bg-white"
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
