"use client";

import { apiClient } from "@/lib/api";
import type {
  ConfirmReceiptInput,
  ConfirmReceiptOutput,
  PaginatedResponse,
  ReceiptScan,
  ReceiptScanDetail,
  ScanReceiptInput,
  UpdateScanInput,
} from "@/types/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useRecentScans() {
  return useQuery({
    queryKey: ["receipts", "scans"],
    queryFn: () => apiClient.get<PaginatedResponse<ReceiptScan>>("/receipts/?page_size=20"),
    staleTime: Infinity,
  });
}

export function useScanDetail(scanId: string | null) {
  return useQuery({
    queryKey: ["receipts", "scan", scanId],
    queryFn: () => apiClient.get<ReceiptScanDetail>(`/receipts/${scanId}`),
    staleTime: Infinity,
    enabled: !!scanId,
  });
}

export function useScanReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ScanReceiptInput) =>
      apiClient.post<ReceiptScanDetail>("/receipts/scan", input, { timeout: 120_000 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });
}

export function useUpdateScan(scanId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateScanInput) =>
      apiClient.patch<ReceiptScanDetail>(`/receipts/${scanId}`, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["receipts", "scan", scanId] });
      const previous = queryClient.getQueryData<ReceiptScanDetail>(["receipts", "scan", scanId]);
      if (previous) {
        queryClient.setQueryData<ReceiptScanDetail>(["receipts", "scan", scanId], {
          ...previous,
          ...input,
        });
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["receipts", "scan", scanId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts", "scans"] });
    },
  });
}

export function useConfirmReceipt(scanId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConfirmReceiptInput) =>
      apiClient.post<ConfirmReceiptOutput>(`/receipts/${scanId}/confirm`, input),
    onSuccess: () => {
      // refetchType "all" ensures inactive queries (e.g. dashboard summary)
      // refetch immediately, not just when their component next mounts
      queryClient.invalidateQueries({ queryKey: ["pantry"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["recipes", "suggest"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });
}

export function useDeleteScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scanId: string) => apiClient.delete(`/receipts/${scanId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });
}
