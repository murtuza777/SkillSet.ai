import type { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/server/backend-proxy";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => proxyToBackend(request, "/auth/me");
