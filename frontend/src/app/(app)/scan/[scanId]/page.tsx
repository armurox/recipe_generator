"use client";

import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmReceipt, useDeleteScan, useScanDetail } from "@/hooks/use-receipts";
import { ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmActions } from "./_components/confirm-actions";
import { NonFoodItems } from "./_components/non-food-items";
import { ReviewItemRow } from "./_components/review-item-row";

export type ReviewFormValues = {
  items: {
    receipt_item_id: number;
    ingredient_name: string;
    quantity: string;
    unit: string;
  }[];
};

export default function ScanReviewPage() {
  const params = useParams<{ scanId: string }>();
  const router = useRouter();
  const { data: scan, isLoading } = useScanDetail(params.scanId);
  const confirmReceipt = useConfirmReceipt(params.scanId);
  const deleteScan = useDeleteScan();

  const isConfirmed = scan?.status === "confirmed";

  const form = useForm<ReviewFormValues>({
    defaultValues: { items: [] },
  });

  const { fields, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Populate form when scan data arrives
  const foodItems = useMemo(() => scan?.items.filter((item) => item.is_food) ?? [], [scan]);
  const nonFoodItems = useMemo(() => scan?.items.filter((item) => !item.is_food) ?? [], [scan]);

  useEffect(() => {
    if (foodItems.length > 0 && fields.length === 0) {
      form.reset({
        items: foodItems.map((item) => ({
          receipt_item_id: item.id,
          ingredient_name: item.ingredient_name ?? item.raw_text,
          quantity: item.quantity != null ? String(item.quantity) : "1",
          unit: item.unit ?? "pcs",
        })),
      });
    }
  }, [foodItems, fields.length, form]);

  // Confidence score: percentage of items with a resolved ingredient name
  const confidenceScore = useMemo(() => {
    if (!scan?.items.length) return 0;
    const food = scan.items.filter((i) => i.is_food);
    if (food.length === 0) return 0;
    const resolved = food.filter((i) => i.ingredient_name && i.ingredient_name.length > 4);
    return Math.round((resolved.length / food.length) * 100);
  }, [scan]);

  async function handleConfirm() {
    const values = form.getValues();
    try {
      const result = await confirmReceipt.mutateAsync({
        items: values.items.map((item) => ({
          receipt_item_id: item.receipt_item_id,
          ingredient_name: item.ingredient_name,
          quantity: item.quantity ? Number(item.quantity) : null,
          unit: item.unit,
        })),
      });
      const total = result.pantry_items_created + result.pantry_items_updated;
      toast.success(`${total} items added to pantry`);
      router.push("/pantry");
    } catch {
      toast.error("Failed to confirm items. Please try again.");
    }
  }

  async function handleDiscard() {
    try {
      await deleteScan.mutateAsync(params.scanId);
      toast.success("Scan discarded");
      router.push("/scan");
    } catch {
      toast.error("Failed to discard scan.");
    }
  }

  if (isLoading) {
    return (
      <div className="px-5 pt-4">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-4 h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="px-5 py-20 text-center">
        <div className="mb-3 text-5xl">🔍</div>
        <h2 className="mb-2 text-lg font-semibold">Scan not found</h2>
        <Link href="/scan" className="text-sm font-medium text-green-700 underline">
          Back to Scan
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-3">
        <Link
          href="/scan"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 text-gray-700" />
        </Link>
        <h1 className="text-[22px] font-bold text-gray-900">
          {isConfirmed ? "Scan Details" : "Review Items"}
        </h1>
      </div>

      <div className="px-5 pb-24">
        {/* Confirmed banner */}
        {isConfirmed && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-green-100 px-4 py-3">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-700" />
            <div className="text-[14px] font-medium text-green-800">
              Items from this scan have been added to your pantry.
            </div>
          </div>
        )}

        {/* Store banner */}
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3">
          <span className="text-2xl">🏪</span>
          <div>
            <div className="text-[14px] font-semibold text-gray-900">
              {scan.store_name || "Unknown Store"}
            </div>
            <div className="text-[12px] text-gray-500">
              Detected from receipt · {foodItems.length} items found
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] text-gray-500">Extraction confidence</span>
          <span className="text-[13px] font-semibold text-green-600">{confidenceScore}%</span>
        </div>
        <div className="mb-5">
          <Progress value={confidenceScore} className="h-2" />
        </div>

        {/* Extracted items */}
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-gray-900">
              {isConfirmed ? "Items" : "Extracted Items"}
            </span>
            <span className="text-[13px] text-gray-500">
              {isConfirmed ? foodItems.length : fields.length} items
            </span>
          </div>
          {isConfirmed
            ? foodItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center border-b border-gray-100 py-3 last:border-b-0"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                  <span className="ml-2.5 min-w-0 flex-1 text-[15px] font-medium text-gray-900">
                    {item.ingredient_name ?? item.raw_text}
                  </span>
                  {item.quantity != null && (
                    <span className="text-[13px] text-gray-500">
                      {item.quantity} {item.unit ?? ""}
                    </span>
                  )}
                </div>
              ))
            : fields.map((field, index) => (
                <ReviewItemRow
                  key={field.id}
                  index={index}
                  ingredientName={foodItems[index]?.ingredient_name ?? null}
                  register={form.register}
                  onRemove={() => remove(index)}
                />
              ))}
          {!isConfirmed && fields.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-500">
              No food items found. Try uploading a clearer image.
            </p>
          )}
        </div>

        {/* Non-food items */}
        <NonFoodItems items={nonFoodItems} />

        {/* Actions — only shown for unconfirmed scans */}
        {!isConfirmed && (
          <ConfirmActions
            onConfirm={handleConfirm}
            onDiscard={handleDiscard}
            isConfirming={confirmReceipt.isPending}
            isDiscarding={deleteScan.isPending}
            itemCount={fields.length}
          />
        )}
      </div>
    </div>
  );
}
