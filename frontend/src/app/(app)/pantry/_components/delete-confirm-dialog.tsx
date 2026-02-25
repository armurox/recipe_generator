"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  onConfirm: () => void;
  isDeleting: boolean;
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemCount,
  onConfirm,
  isDeleting,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-3rem)] max-w-[320px] rounded-xl">
        <DialogHeader>
          <DialogTitle>Delete {itemCount === 1 ? "item" : `${itemCount} items`}?</DialogTitle>
          <DialogDescription>
            {itemCount === 1
              ? "This item will be permanently removed from your pantry."
              : `These ${itemCount} items will be permanently removed from your pantry.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-[14px] font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
