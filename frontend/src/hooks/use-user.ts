"use client";

import { apiClient } from "@/lib/api";
import type { User, UserUpdate } from "@/types/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["user", "me"],
    queryFn: () => apiClient.get<User>("/me"),
    staleTime: Infinity,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserUpdate) => apiClient.patch<User>("/me", data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["user", "me"], updatedUser);
    },
  });
}
