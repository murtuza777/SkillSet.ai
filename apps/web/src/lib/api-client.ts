import type { ApiEnvelope } from "@/types/domain";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const createPath = (path: string) => (path.startsWith("/api/") ? path : `/api${path}`);

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(createPath(path), {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.error?.message ?? "Request failed",
      response.status,
      payload?.error?.details ?? null,
    );
  }

  return payload.data;
}

export const postJson = <T>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const patchJson = <T>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const putJson = <T>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
