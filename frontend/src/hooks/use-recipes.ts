"use client";

import { apiClient } from "@/lib/api";
import type { SuggestRecipesResponse } from "@/types/api";
import { useQuery } from "@tanstack/react-query";

export function useRecipeSuggestions(count: number = 10) {
  return useQuery({
    queryKey: ["recipes", "suggest", { count }],
    queryFn: () => apiClient.get<SuggestRecipesResponse>(`/recipes/suggest?count=${count}`),
    staleTime: 5 * 60 * 1000,
  });
}
