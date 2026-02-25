"use client";

import { apiClient } from "@/lib/api";
import type {
  CookingLogInput,
  RecipeDetail,
  SavedRecipe,
  SearchResults,
  SuggestRecipesResponse,
} from "@/types/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useRecipeSuggestions(count: number = 10) {
  return useQuery({
    queryKey: ["recipes", "suggest", { count }],
    queryFn: () => apiClient.get<SuggestRecipesResponse>(`/recipes/suggest?count=${count}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecipeSearch(query: string, diet?: string, page: number = 1) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  if (diet) params.set("diet", diet);

  return useQuery({
    queryKey: ["recipes", "search", { q: query, diet, page }],
    queryFn: () => apiClient.get<SearchResults>(`/recipes/search?${params}`),
    staleTime: 5 * 60 * 1000,
    enabled: query.trim().length > 0,
  });
}

export function useRecipeDetail(recipeId: string | null) {
  return useQuery({
    queryKey: ["recipes", "detail", recipeId],
    queryFn: () => apiClient.get<RecipeDetail>(`/recipes/${recipeId}`),
    staleTime: 30 * 60 * 1000,
    enabled: !!recipeId,
  });
}

export function useSaveRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, notes }: { recipeId: string; notes?: string }) =>
      apiClient.post<SavedRecipe>(`/recipes/${recipeId}/save`, notes ? { notes } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useUnsaveRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) => apiClient.delete(`/recipes/${recipeId}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useLogCooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, input }: { recipeId: string; input?: CookingLogInput }) =>
      apiClient.post(`/recipes/${recipeId}/cooked`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", "history"] });
    },
  });
}
