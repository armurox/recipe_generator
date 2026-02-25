"use client";

import { apiClient } from "@/lib/api";
import type { PaginatedResponse, PantryItem, PantrySummary } from "@/types/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function usePantrySummary() {
  return useQuery({
    queryKey: ["pantry", "summary"],
    queryFn: () => apiClient.get<PantrySummary>("/pantry/summary"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useExpiringItems(days: number = 3) {
  return useQuery({
    queryKey: ["pantry", "expiring", { days }],
    queryFn: () => apiClient.get<PantryItem[]>(`/pantry/expiring?days=${days}`),
    staleTime: 2 * 60 * 1000,
  });
}

type PantryFilters = {
  status?: string;
  expiring_within?: number;
  category?: number;
  search?: string;
  page?: number;
};

function buildPantryParams(filters: PantryFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.expiring_within !== undefined)
    params.set("expiring_within", String(filters.expiring_within));
  if (filters.category !== undefined) params.set("category", String(filters.category));
  if (filters.search) params.set("search", filters.search);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", "200");
  return params.toString();
}

export function usePantryItems(filters: PantryFilters = {}) {
  const queryString = buildPantryParams(filters);

  return useQuery({
    queryKey: ["pantry", "items", filters],
    queryFn: () => apiClient.get<PaginatedResponse<PantryItem>>(`/pantry?${queryString}`),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function usePantrySearch(search: string, filters: PantryFilters = {}) {
  const searchFilters = { ...filters, search };
  const queryString = buildPantryParams(searchFilters);

  return useQuery({
    queryKey: ["pantry", "search", searchFilters],
    queryFn: () => apiClient.get<PaginatedResponse<PantryItem>>(`/pantry?${queryString}`),
    staleTime: 2 * 60 * 1000,
    enabled: search.trim().length > 0,
    placeholderData: keepPreviousData,
  });
}
