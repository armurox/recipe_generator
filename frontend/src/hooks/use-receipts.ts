"use client";

import { apiClient } from "@/lib/api";
import type {
  ConfirmReceiptInput,
  ConfirmReceiptOutput,
  PaginatedResponse,
  ReceiptScan,
  ReceiptScanDetail,
  ScanReceiptInput,
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
      apiClient.post<ReceiptScanDetail>("/receipts/scan", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
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
