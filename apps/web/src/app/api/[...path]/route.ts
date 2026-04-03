import type { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/server/backend-proxy";

export const dynamic = "force-dynamic";

const createPath = (request: NextRequest, path: string[] | undefined) => {
  const segments = path ?? [];
  const isSkillsFeatureRoute =
    segments[0] === "skills" &&
    (segments[1] === "create" ||
      segments[1] === "lessons" ||
      (segments.length >= 3 && segments[2] === "progress"));
  const isSquadChatRoute =
    segments[0] === "chat" &&
    (segments[1] === "send" || segments[1] === "messages" || segments[1] === "ws");

  const pathname = isSkillsFeatureRoute || isSquadChatRoute
    ? `/api/${segments.join("/")}`
    : `/${segments.join("/")}`;
  return `${pathname}${request.nextUrl.search}`;
};

export const GET = async (
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) => {
  const { path } = await context.params;
  return proxyToBackend(request, createPath(request, path));
};

export const POST = GET;
export const PATCH = GET;
export const PUT = GET;
export const DELETE = GET;
