"use client";

import { ExpiryBadge } from "@/components/expiry-badge";
import type { PantryItem } from "@/types/api";

type PantryItemRowProps = {
  item: PantryItem;
};

export function PantryItemRow({ item }: PantryItemRowProps) {
  const quantityText = [item.quantity, item.unit].filter(Boolean).join("");

  return (
    <div className="flex items-center border-b border-gray-100 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium">{item.ingredient.name}</div>
        {quantityText && (
          <div className="mt-0.5 text-[13px] text-gray-500">{quantityText}</div>
        )}
      </div>
      <ExpiryBadge expiryDate={item.expiry_date} showDate />
    </div>
  );
}
