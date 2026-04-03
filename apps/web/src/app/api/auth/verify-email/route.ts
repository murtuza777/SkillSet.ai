import type { NextRequest } from "next/server";

import { proxyAuthMutation } from "@/lib/server/backend-proxy";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest) =>
  proxyAuthMutation(request, "/auth/verify-email");
