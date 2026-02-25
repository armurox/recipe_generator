"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAddPantryItem, usePantrySummary } from "@/hooks/use-pantry";
import { useState } from "react";
import { toast } from "sonner";

type AddItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddItemDialog({ open, onOpenChange }: AddItemDialogProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [category, setCategory] = useState("");
  const addItem = useAddPantryItem();
  const { data: summary } = usePantrySummary();

  const categoryNames =
    summary?.categories
      .map((c) => c.category_name)
      .filter((n) => n !== "Uncategorized")
      .sort() ?? [];

  function reset() {
    setName("");
    setQuantity("");
    setUnit("");
    setExpiryDate("");
    setCategory("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const result = await addItem.mutateAsync({
        ingredient_name: name.trim(),
        quantity: quantity ? parseFloat(quantity) : null,
        unit: unit.trim() || null,
        expiry_date: expiryDate || null,
        category_hint: category.trim() || null,
      });
      toast.success(
        result.created ? `${name.trim()} added to pantry` : `${name.trim()} quantity updated`,
      );
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to add item");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="w-64 gap-2 rounded-xl p-4 pt-5">
        <DialogHeader className="p-0">
          <DialogTitle className="text-[15px]">Add Pantry Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
              Ingredient <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chicken Breast"
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] outline-none focus:border-green-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-0.5 block text-[11px] font-medium text-gray-500">Qty</label>
              <input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="500"
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] outline-none focus:border-green-500"
              />
            </div>
            <div className="w-16">
              <label className="mb-0.5 block text-[11px] font-medium text-gray-500">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="g"
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-0.5 block text-[11px] font-medium text-gray-500">Category</label>
            <input
              type="text"
              list="category-hints"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Dairy"
              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] outline-none focus:border-green-500"
            />
            <datalist id="category-hints">
              {categoryNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-0.5 block text-[11px] font-medium text-gray-500">Expiry</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] text-gray-700 outline-none focus:border-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || addItem.isPending}
            className="w-full rounded-lg bg-green-700 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {addItem.isPending ? "Adding..." : "Add Item"}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={addItem.isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-500"
          >
            Cancel
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
