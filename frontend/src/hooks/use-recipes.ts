"use client";

import { apiClient } from "@/lib/api";
import type {
  CookingLogInput,
  RecipeDetail,
  SavedRecipe,
  SearchResults,
  SuggestRecipesResponse,
} from "@/types/api";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useRecipeSuggestions(pageSize: number = 10) {
  return useQuery({
    queryKey: ["recipes", "suggest", { pageSize }],
    queryFn: () =>
      apiClient.get<SuggestRecipesResponse>(`/recipes/suggest?page=1&page_size=${pageSize}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useInfiniteRecipeSuggestions(pageSize: number = 10) {
  return useInfiniteQuery({
    queryKey: ["recipes", "suggest", "infinite", { pageSize }],
    queryFn: ({ pageParam = 1 }) =>
      apiClient.get<SuggestRecipesResponse>(
        `/recipes/suggest?page=${pageParam}&page_size=${pageSize}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const fetched = lastPageParam * pageSize;
      // When total_results is known, check if we've fetched everything
      if (lastPage.total_results !== null && fetched >= lastPage.total_results) return undefined;
      // When total_results is null (findByIngredients), use page size heuristic
      if (lastPage.items.length < pageSize) return undefined;
      return lastPageParam + 1;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInfiniteRecipeSearch(
  query: string,
  diet?: string,
  pageSize: number = 10,
  maxReadyTime?: number,
) {
  return useInfiniteQuery({
    queryKey: ["recipes", "search", "infinite", { q: query, diet, pageSize, maxReadyTime }],
    queryFn: ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        page_size: String(pageSize),
      });
      if (query.trim()) params.set("q", query);
      if (diet) params.set("diet", diet);
      if (maxReadyTime) params.set("max_ready_time", String(maxReadyTime));
      return apiClient.get<SearchResults>(`/recipes/search?${params}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const fetched = lastPageParam * pageSize;
      if (fetched >= lastPage.total_results) return undefined;
      if (lastPage.items.length < pageSize) return undefined;
      return lastPageParam + 1;
    },
    staleTime: 5 * 60 * 1000,
    enabled: query.trim().length > 0 || !!diet || !!maxReadyTime,
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
