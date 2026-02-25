"use client";

import { apiClient } from "@/lib/api";
import type { User } from "@/types/api";
import { useQuery } from "@tanstack/react-query";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["user", "me"],
    queryFn: () => apiClient.get<User>("/me"),
    staleTime: Infinity,
  });
}
