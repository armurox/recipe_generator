"use client";

import type { PantryItem } from "@/types/api";
import { PantryItemRow } from "./pantry-item-row";

type CategoryGroupProps = {
  categoryName: string;
  categoryIcon: string | null;
  items: PantryItem[];
  isSelectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onQuantityChange: (id: string, newQuantity: number) => void;
};

export function CategoryGroup({
  categoryName,
  categoryIcon,
  items,
  isSelectMode,
  selectedIds,
  onToggleSelect,
  onDeleteItem,
  onQuantityChange,
}: CategoryGroupProps) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <span className="text-lg">{categoryIcon ?? "📦"}</span>
        {categoryName}
      </div>
      <div className="rounded-xl bg-white px-4 py-1 shadow-sm">
        {items.map((item) => (
          <PantryItemRow
            key={item.id}
            item={item}
            isSelectMode={isSelectMode}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={onToggleSelect}
            onDelete={onDeleteItem}
            onQuantityChange={onQuantityChange}
          />
        ))}
      </div>
    </div>
  );
}
