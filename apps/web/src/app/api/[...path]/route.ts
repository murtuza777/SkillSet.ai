import type { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/server/backend-proxy";

const createPath = (request: NextRequest, path: string[] | undefined) => {
  const pathname = `/${(path ?? []).join("/")}`;
  return `${pathname}${request.nextUrl.search}`;
};

export const GET = (
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) =>
  context.params.then(({ path }) =>
    proxyToBackend(request, createPath(request, path)),
  );

export const POST = GET;
export const PATCH = GET;
export const PUT = GET;
export const DELETE = GET;
