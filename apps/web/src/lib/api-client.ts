"use client";

import type { ApiEnvelope } from "@/types/domain";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const toApiPath = (path: string) => {
  if (!path.startsWith("/")) {
    throw new Error(`API path must start with "/" (received "${path}")`);
  }

  return path.startsWith("/api/") ? path : `/api${path}`;
};

const parseJson = async <T>(response: Response) => {
  const text = await response.text();
  if (!text.trim()) {
    return null as T | null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T | null;
  }
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const request = async <T>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: unknown;
    headers?: HeadersInit;
  } = {},
) => {
  const response = await fetch(toApiPath(path), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "same-origin",
    cache: "no-store",
  });

  const payload = await parseJson<ApiEnvelope<T>>(response);
  if (!response.ok) {
    const message =
      payload?.error?.message ??
      response.statusText ??
      "Request failed";
    throw new ApiError(message, response.status, payload?.error?.details ?? null);
  }

  if (!payload?.success) {
    throw new ApiError("Malformed API response", response.status, payload ?? null);
  }

  return payload.data;
};

export const apiRequest = <T>(path: string) => request<T>(path, { method: "GET" });
export const postJson = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body });
export const putJson = <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body });
export const patchJson = <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body });
export const deleteJson = <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body });
