"use client";

import { Trash2, X } from "lucide-react";

type BulkActionBarProps = {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: () => void;
  isDeleting: boolean;
};

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  isDeleting,
}: BulkActionBarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4">
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onDeselectAll}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100"
          >
            <X className="h-3.5 w-3.5 text-gray-600" />
          </button>
          <span className="text-[13px] font-medium text-gray-700">{selectedCount} selected</span>
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-[12px] font-medium text-green-700"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting || selectedCount === 0}
          className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {selectedCount > 0 ? `${selectedCount}` : "Delete"}
        </button>
      </div>
    </div>
  );
}
