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
      <DialogContent className="w-64 gap-2 rounded-xl p-4">
        <DialogHeader className="p-0">
          <DialogTitle className="text-[15px]">
            Delete {itemCount === 1 ? "item" : `${itemCount} items`}?
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {itemCount === 1
              ? "This will be permanently removed from your pantry."
              : `These ${itemCount} items will be permanently removed.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-1.5 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full rounded-lg bg-red-500 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-500"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
