import type { ReceiptItem } from "@/types/api";

type NonFoodItemsProps = {
  items: ReceiptItem[];
};

export function NonFoodItems({ items }: NonFoodItemsProps) {
  if (items.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl bg-white p-4 opacity-60 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[15px] font-semibold text-gray-900">Skipped (non-food)</span>
        <span className="text-[13px] text-gray-500">{items.length} items</span>
      </div>
      <div className="text-[13px] leading-relaxed text-gray-500">
        {items.map((item) => item.raw_text).join(" · ")}
      </div>
    </div>
  );
}
