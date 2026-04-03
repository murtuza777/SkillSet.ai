import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE_NAME = "skillset_access";
const REFRESH_COOKIE_NAME = "skillset_refresh";

type JsonRecord = Record<string, unknown>;

const isSecureRequest = (request: NextRequest) =>
  request.nextUrl.protocol === "https:";

const getAccessTokenCookie = async () =>
  (await cookies()).get(ACCESS_COOKIE_NAME)?.value ?? null;

const getRefreshCookieHeader = async () => {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE_NAME)?.value;
  return refreshToken ? `${REFRESH_COOKIE_NAME}=${refreshToken}` : "";
};

const getApiBaseUrl = async () => {
  const { env } = await getCloudflareContext({ async: true });
  const baseUrl = env.SKILLSET_API_BASE_URL ?? process.env.SKILLSET_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("SKILLSET_API_BASE_URL is not configured");
  }

  return baseUrl.replace(/\/$/, "");
};

const parseJson = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value) as JsonRecord;
  } catch {
    return null;
  }
};

const setAccessCookie = (
  response: NextResponse,
  request: NextRequest,
  accessToken: string | null,
) => {
  if (!accessToken) {
    response.cookies.delete(ACCESS_COOKIE_NAME);
    return;
  }

  response.cookies.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
  });
};

const getAccessTokenFromPayload = (payload: JsonRecord | null) => {
  if (!payload?.success || !payload.data || typeof payload.data !== "object") {
    return null;
  }

  const accessToken = (payload.data as JsonRecord).accessToken;
  return typeof accessToken === "string" ? accessToken : null;
};

const appendRefreshCookie = (
  response: NextResponse,
  backendResponse: Response,
) => {
  const refreshCookie = backendResponse.headers.get("set-cookie");

  if (refreshCookie) {
    response.headers.append("set-cookie", refreshCookie);
  }
};

const getForwardHeaders = (request: NextRequest, accessToken?: string | null) => {
  const headers = new Headers();
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");

  if (accept) {
    headers.set("accept", accept);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  return headers;
};

const createProxyResponse = (
  request: NextRequest,
  backendResponse: Response,
  bodyText: string,
  options?: {
    accessToken?: string | null;
    clearAccess?: boolean;
  },
) => {
  const response = new NextResponse(bodyText, {
    status: backendResponse.status,
    headers: {
      "content-type":
        backendResponse.headers.get("content-type") ?? "application/json",
    },
  });

  appendRefreshCookie(response, backendResponse);

  if (options?.clearAccess) {
    response.cookies.delete(ACCESS_COOKIE_NAME);
  } else if (options && "accessToken" in options) {
    setAccessCookie(response, request, options.accessToken ?? null);
  }

  return response;
};

const sanitizeAuthPayload = (payload: JsonRecord | null) => {
  if (!payload) {
    return payload;
  }

  if (!payload.success || !payload.data || typeof payload.data !== "object") {
    return payload;
  }

  const data = { ...(payload.data as JsonRecord) };
  delete data.accessToken;
  return {
    ...payload,
    data,
  };
};

const fetchBackend = async (
  path: string,
  init: RequestInit = {},
) => {
  const baseUrl = await getApiBaseUrl();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    redirect: "manual",
    cache: "no-store",
  });
};

const refreshAccessToken = async () => {
  const refreshCookie = await getRefreshCookieHeader();

  if (!refreshCookie) {
    return null;
  }

  const response = await fetchBackend("/auth/refresh", {
    method: "POST",
    headers: {
      cookie: refreshCookie,
    },
  });
  const bodyText = await response.text();
  const payload = parseJson(bodyText);
  const accessToken =
    payload?.success && payload.data && typeof payload.data === "object"
      ? (payload.data as JsonRecord).accessToken
      : null;

  if (typeof accessToken !== "string") {
    return null;
  }

  return {
    backendResponse: response,
    bodyText,
    accessToken,
  };
};

export const proxyAuthMutation = async (
  request: NextRequest,
  backendPath: string,
) => {
  const bodyText =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();
  const backendResponse = await fetchBackend(backendPath, {
    method: request.method,
    headers: getForwardHeaders(request),
    body: bodyText,
  });
  const responseText = await backendResponse.text();
  const rawPayload = parseJson(responseText);
  const payload = sanitizeAuthPayload(rawPayload);
  const nextResponse = createProxyResponse(
    request,
    backendResponse,
    payload ? JSON.stringify(payload) : responseText,
    {
      accessToken: getAccessTokenFromPayload(rawPayload),
      clearAccess: backendPath === "/auth/logout",
    },
  );

  if (backendPath === "/auth/logout") {
    nextResponse.cookies.delete(REFRESH_COOKIE_NAME);
  }

  return nextResponse;
};

export const proxyToBackend = async (
  request: NextRequest,
  backendPath: string,
) => {
  const accessToken = await getAccessTokenCookie();
  const requestBody =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  let backendResponse = await fetchBackend(backendPath, {
    method: request.method,
    headers: getForwardHeaders(request, accessToken),
    body: requestBody,
  });
  let responseText = await backendResponse.text();
  let refreshedAccessToken: string | null | undefined;
  let refreshResponse: Response | null = null;

  if (backendResponse.status === 401) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      refreshedAccessToken = refreshed.accessToken;
      refreshResponse = refreshed.backendResponse;
      backendResponse = await fetchBackend(backendPath, {
        method: request.method,
        headers: getForwardHeaders(request, refreshed.accessToken),
        body: requestBody,
      });
      responseText = await backendResponse.text();
    }
  }

  const response = createProxyResponse(request, backendResponse, responseText, {
    accessToken: refreshedAccessToken,
    clearAccess: backendResponse.status === 401,
  });

  if (refreshResponse) {
    appendRefreshCookie(response, refreshResponse);
  }

  if (backendResponse.status === 401) {
    response.cookies.delete(REFRESH_COOKIE_NAME);
  }

  return response;
};
