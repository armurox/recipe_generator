"use client";

import { apiClient } from "@/lib/api";
import type {
  BulkDeleteOutput,
  PaginatedResponse,
  PantryItem,
  PantryItemUpdateInput,
  PantrySummary,
} from "@/types/api";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export function useUpdatePantryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PantryItemUpdateInput }) =>
      apiClient.patch<PantryItem>(`/pantry/${id}`, data),
    onMutate: async ({ id, data }) => {
      // Cancel in-flight fetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["pantry"] });

      // Snapshot all pantry queries for rollback
      const previous = queryClient.getQueriesData<PaginatedResponse<PantryItem>>({
        queryKey: ["pantry", "items"],
      });

      // Build a typed partial — only include non-null fields to keep PantryItem types intact
      const patch: Partial<PantryItem> = {};
      if (data.quantity !== undefined && data.quantity !== null) patch.quantity = data.quantity;
      if (data.unit !== undefined && data.unit !== null) patch.unit = data.unit;
      if (data.expiry_date !== undefined && data.expiry_date !== null)
        patch.expiry_date = data.expiry_date;
      if (data.status !== undefined && data.status !== null) patch.status = data.status;

      // Optimistically update every cached pantry list that contains this item
      queryClient.setQueriesData<PaginatedResponse<PantryItem>>(
        { queryKey: ["pantry", "items"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
          };
        },
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back to snapshots
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["recipes", "suggest"], refetchType: "all" });
    },
  });
}

export function useDeletePantryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/pantry/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["recipes", "suggest"], refetchType: "all" });
    },
  });
}

export function useBulkDeletePantryItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.post<BulkDeleteOutput>("/pantry/bulk-delete", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["recipes", "suggest"], refetchType: "all" });
    },
  });
}
