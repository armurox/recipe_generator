"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBulkAddPantryItems, usePantrySummary } from "@/hooks/use-pantry";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

const itemSchema = z.object({
  ingredient_name: z.string().min(1, "Required"),
  quantity: z.string().optional(),
  unit: z.string().optional(),
  expiry_date: z.string().optional(),
  category_hint: z.string().optional(),
});

const formSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_ROW = {
  ingredient_name: "",
  quantity: "",
  unit: "",
  expiry_date: "",
  category_hint: "",
};

type AddItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: "available" | "to_buy";
};

export function AddItemDialog({
  open,
  onOpenChange,
  defaultStatus = "available",
}: AddItemDialogProps) {
  const bulkAdd = useBulkAddPantryItems();
  const isOnline = useOnlineStatus();
  const { data: summary } = usePantrySummary();

  const categoryNames =
    summary?.categories
      .map((c) => c.category_name)
      .filter((n) => n !== "Uncategorized")
      .sort() ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { items: [{ ...EMPTY_ROW }] },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = useWatch({ control: form.control, name: "items" });
  const filledCount = watchedItems.filter((item) => item.ingredient_name.trim().length > 0).length;

  function resetAndClose() {
    form.reset({ items: [{ ...EMPTY_ROW }] });
    onOpenChange(false);
  }

  async function onSubmit(values: FormValues) {
    const items = values.items
      .filter((item) => item.ingredient_name.trim().length > 0)
      .map((item) => ({
        ingredient_name: item.ingredient_name.trim(),
        quantity: item.quantity ? parseFloat(item.quantity) : null,
        unit: item.unit?.trim() || null,
        expiry_date: item.expiry_date || null,
        category_hint: item.category_hint?.trim() || null,
        status: defaultStatus,
      }));

    if (items.length === 0) return;

    try {
      const result = await bulkAdd.mutateAsync({ items });
      const total = result.created_count + result.updated_count;
      const parts: string[] = [];
      if (result.created_count > 0) parts.push(`${result.created_count} added`);
      if (result.updated_count > 0) parts.push(`${result.updated_count} updated`);
      toast.success(`${total} ${total === 1 ? "item" : "items"}: ${parts.join(", ")}`);
      resetAndClose();
    } catch {
      toast.error("Failed to add items");
    }
  }

  const isShopping = defaultStatus === "to_buy";
  const title = isShopping ? "Add Shopping Items" : "Add Pantry Items";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          form.reset({ items: [{ ...EMPTY_ROW }] });
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="w-80 gap-2 rounded-xl p-4 pt-5">
        <DialogHeader className="p-0">
          <DialogTitle className="text-[15px]">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-1.5">
                {index > 0 && <div className="border-t border-gray-100" />}
                <div className="flex items-start gap-1.5">
                  <div className="min-w-0 flex-1">
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...form.register(`items.${index}.ingredient_name`)}
                      placeholder="e.g. Chicken Breast"
                      autoFocus={index === 0}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] outline-none focus:border-green-500"
                    />
                    {form.formState.errors.items?.[index]?.ingredient_name && (
                      <p className="mt-0.5 text-[11px] text-red-500">
                        {form.formState.errors.items[index].ingredient_name.message}
                      </p>
                    )}
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mt-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <div className="w-16">
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
                      Qty
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      {...form.register(`items.${index}.quantity`)}
                      placeholder="500"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-[13px] outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="w-14">
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
                      Unit
                    </label>
                    <input
                      type="text"
                      {...form.register(`items.${index}.unit`)}
                      placeholder="g"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-[13px] outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
                      Category
                    </label>
                    <input
                      type="text"
                      list="category-hints"
                      {...form.register(`items.${index}.category_hint`)}
                      placeholder="Dairy"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-[13px] outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="w-[110px]">
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
                      Expiry
                    </label>
                    <input
                      type="date"
                      {...form.register(`items.${index}.expiry_date`)}
                      className="w-full rounded-lg border border-gray-300 px-1.5 py-1.5 text-[13px] text-gray-700 outline-none focus:border-green-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <datalist id="category-hints">
            {categoryNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <button
            type="button"
            onClick={() => append({ ...EMPTY_ROW })}
            disabled={fields.length >= 50}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-500 hover:border-green-500 hover:text-green-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>

          <button
            type="submit"
            disabled={filledCount === 0 || bulkAdd.isPending || !isOnline}
            className="w-full rounded-lg bg-green-700 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {bulkAdd.isPending
              ? "Adding..."
              : `Add ${filledCount} ${filledCount === 1 ? "Item" : "Items"}`}
          </button>
          <button
            type="button"
            onClick={resetAndClose}
            disabled={bulkAdd.isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-500"
          >
            Cancel
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
