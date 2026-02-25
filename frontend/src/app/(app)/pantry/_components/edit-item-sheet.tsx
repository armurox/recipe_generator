"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useDeletePantryItem,
  usePantrySummary,
  useUpdatePantryItem,
  useUsePantryItem,
} from "@/hooks/use-pantry";
import type { PantryItem } from "@/types/api";
import { Minus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type EditItemSheetProps = {
  item: PantryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditItemSheet({ item, open, onOpenChange }: EditItemSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[70vh] max-w-md overflow-y-auto rounded-t-2xl pb-6"
      >
        {item && <EditItemForm key={item.id} item={item} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function EditItemForm({ item, onClose }: { item: PantryItem; onClose: () => void }) {
  const [quantity, setQuantity] = useState(item.quantity != null ? String(item.quantity) : "");
  const [unit, setUnit] = useState(item.unit ?? "");
  const [expiryDate, setExpiryDate] = useState(item.expiry_date ?? "");
  const [status, setStatus] = useState(item.status);
  const [category, setCategory] = useState(item.ingredient.category_name ?? "");
  const [useQuantity, setUseQuantity] = useState("");
  const [showUseForm, setShowUseForm] = useState(false);

  const updateItem = useUpdatePantryItem();
  const deleteItem = useDeletePantryItem();
  const useItem = useUsePantryItem();
  const { data: summary } = usePantrySummary();

  const categoryNames =
    summary?.categories
      .map((c) => c.category_name)
      .filter((n) => n !== "Uncategorized")
      .sort() ?? [];

  const hasChanges =
    quantity !== (item.quantity != null ? String(item.quantity) : "") ||
    unit !== (item.unit ?? "") ||
    expiryDate !== (item.expiry_date ?? "") ||
    status !== item.status ||
    category !== (item.ingredient.category_name ?? "");

  async function handleSave() {
    if (!hasChanges) return;

    const data: Record<string, unknown> = {};
    const newQty = quantity ? parseFloat(quantity) : null;
    if (newQty !== item.quantity) data.quantity = newQty;
    if (unit.trim() !== (item.unit ?? "")) data.unit = unit.trim() || null;
    if (expiryDate !== (item.expiry_date ?? "")) data.expiry_date = expiryDate || null;
    if (status !== item.status) data.status = status;
    if (category.trim() !== (item.ingredient.category_name ?? ""))
      data.category_hint = category.trim() || null;

    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: data as {
          quantity?: number | null;
          unit?: string | null;
          expiry_date?: string | null;
          status?: string | null;
          category_hint?: string | null;
        },
      });
      toast.success("Item updated");
      onClose();
    } catch {
      toast.error("Failed to update item");
    }
  }

  async function handleUse() {
    const qty = useQuantity ? parseFloat(useQuantity) : undefined;
    try {
      await useItem.mutateAsync({
        id: item.id,
        data: qty != null ? { quantity: qty } : undefined,
      });
      toast.success(
        qty != null
          ? `Used ${qty} ${item.unit ?? ""}`.trim()
          : `${item.ingredient.name} marked as used`,
      );
      onClose();
    } catch {
      toast.error("Failed to mark as used");
    }
  }

  async function handleDelete() {
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success("Item deleted");
      onClose();
    } catch {
      toast.error("Failed to delete item");
    }
  }

  const isPending = updateItem.isPending || deleteItem.isPending || useItem.isPending;
  const isAvailable = item.status === "available";

  return (
    <>
      <SheetHeader className="pb-0">
        <SheetTitle className="text-base">{item.ingredient.name}</SheetTitle>
      </SheetHeader>

      <div className="space-y-3 px-4">
        {/* Row 1: Quantity + Unit + Status */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-0.5 block text-[12px] font-medium text-gray-500">Qty</label>
            <input
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-[14px] outline-none focus:border-green-500 disabled:opacity-50"
            />
          </div>
          <div className="w-20">
            <label className="mb-0.5 block text-[12px] font-medium text-gray-500">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="g, ml"
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-[14px] outline-none focus:border-green-500 disabled:opacity-50"
            />
          </div>
          <div className="w-28">
            <label className="mb-0.5 block text-[12px] font-medium text-gray-500">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-[14px] outline-none focus:border-green-500 disabled:opacity-50"
            >
              <option value="available">Available</option>
              <option value="expired">Expired</option>
              <option value="used_up">Used Up</option>
            </select>
          </div>
        </div>

        {/* Row 2: Category + Expiry */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-0.5 block text-[12px] font-medium text-gray-500">Category</label>
            <input
              type="text"
              list="edit-category-hints"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Dairy"
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-[14px] outline-none focus:border-green-500 disabled:opacity-50"
            />
            <datalist id="edit-category-hints">
              {categoryNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="flex-1">
            <label className="mb-0.5 block text-[12px] font-medium text-gray-500">Expiry</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-[14px] text-gray-700 outline-none focus:border-green-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Use section — only for available items */}
        {isAvailable && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            {!showUseForm ? (
              <button
                type="button"
                onClick={() => setShowUseForm(true)}
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                <Minus className="h-3.5 w-3.5" />
                Use Item
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-gray-600">How much to use?</p>
                <div className="flex items-center gap-2">
                  {item.quantity != null && (
                    <>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={item.quantity}
                        value={useQuantity}
                        onChange={(e) => setUseQuantity(e.target.value)}
                        placeholder={`Max ${item.quantity}`}
                        className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[14px] outline-none focus:border-orange-500"
                      />
                      {item.unit && <span className="text-[12px] text-gray-500">{item.unit}</span>}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowUseForm(false)}
                    disabled={isPending}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUse}
                    disabled={isPending}
                    className="rounded-lg bg-orange-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                  >
                    {useItem.isPending ? "..." : useQuantity ? "Use" : "Use All"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isPending}
            className="flex-1 rounded-lg bg-green-700 px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {updateItem.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
