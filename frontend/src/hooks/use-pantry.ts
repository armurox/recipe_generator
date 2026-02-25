"use client";

import { apiClient } from "@/lib/api";
import type { PaginatedResponse, PantryItem, PantrySummary } from "@/types/api";
import { useQuery } from "@tanstack/react-query";

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
  page?: number;
};

export function usePantryItems(filters: PantryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.expiring_within !== undefined)
    params.set("expiring_within", String(filters.expiring_within));
  if (filters.category !== undefined) params.set("category", String(filters.category));
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", "200");

  const queryString = params.toString();

  return useQuery({
    queryKey: ["pantry", "items", filters],
    queryFn: () => apiClient.get<PaginatedResponse<PantryItem>>(`/pantry?${queryString}`),
    staleTime: 2 * 60 * 1000,
  });
}
