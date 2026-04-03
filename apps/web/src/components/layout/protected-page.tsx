"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSessionQuery } from "@/hooks/use-session";
import { Panel } from "@/components/ui/panel";

export function ProtectedPage({
  children,
  roles,
}: Readonly<{
  children: (session: NonNullable<ReturnType<typeof useSessionQuery>["data"]>) => React.ReactNode;
  roles?: Array<"user" | "mentor" | "admin">;
}>) {
  const router = useRouter();
  const session = useSessionQuery();

  useEffect(() => {
    if (session.isSuccess && !session.data) {
      router.replace("/auth");
    }
  }, [router, session.data, session.isSuccess]);

  if (session.isLoading) {
    return (
      <Panel className="mx-auto mt-10 max-w-2xl">
        <p className="text-lg font-semibold">Loading your workspace...</p>
      </Panel>
    );
  }

  if (!session.data) {
    return null;
  }

  if (roles && !roles.includes(session.data.user.role)) {
    return (
      <Panel className="mx-auto mt-10 max-w-2xl space-y-3">
        <div className="flex items-center gap-3 text-[var(--accent)]">
          <ShieldAlert className="h-5 w-5" />
          <p className="text-lg font-semibold">Access is limited for this account.</p>
        </div>
        <p className="text-[var(--muted)]">
          This page requires one of the following roles: {roles.join(", ")}.
        </p>
      </Panel>
    );
  }

  return <>{children(session.data)}</>;
}
