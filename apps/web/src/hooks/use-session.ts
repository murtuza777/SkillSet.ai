"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError, apiRequest } from "@/lib/api-client";
import type { AuthMe } from "@/types/domain";

export const useSessionQuery = () =>
  useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await apiRequest<AuthMe>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }

        throw error;
      }
    },
    retry: false,
  });
