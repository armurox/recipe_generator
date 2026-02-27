"use client";

import { ExpiryBadge } from "@/components/expiry-badge";
import type { PantryItem } from "@/types/api";
import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";

type PantryItemRowProps = {
  item: PantryItem;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onQuantityChange: (id: string, newQuantity: number) => void;
  onEdit: (item: PantryItem) => void;
};

export function PantryItemRow({
  item,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onDelete,
  onQuantityChange,
  onEdit,
}: PantryItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const hasQuantity = item.quantity != null;
  const quantityDisplay = hasQuantity
    ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
    : null;

  function handleStartEdit() {
    if (!hasQuantity || isSelectMode) return;
    setEditValue(String(item.quantity));
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function handleCommit() {
    setIsEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== item.quantity) {
      onQuantityChange(item.id, parsed);
    }
  }

  function handleRowClick() {
    if (isSelectMode || isEditing) return;
    onEdit(item);
  }

  return (
    <div
      className="flex cursor-pointer items-center gap-2 border-b border-gray-100 py-3 last:border-b-0 active:bg-gray-50"
      onClick={handleRowClick}
    >
      {isSelectMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(item.id);
          }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-[1.5px] ${
            isSelected ? "border-green-600 bg-green-600 text-white" : "border-gray-300 bg-white"
          }`}
        >
          {isSelected && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium">{item.ingredient.name}</div>
        {quantityDisplay && !isEditing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit();
            }}
            className="mt-0.5 text-[13px] text-gray-500 underline decoration-dashed underline-offset-2"
          >
            {quantityDisplay}
          </button>
        )}
        {isEditing && (
          <div className="mt-0.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="number"
              step="any"
              min="0"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommit();
                if (e.key === "Escape") setIsEditing(false);
              }}
              className="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-[13px] outline-none focus:border-green-500"
            />
            {item.unit && <span className="text-[13px] text-gray-400">{item.unit}</span>}
          </div>
        )}
        {!quantityDisplay && !isEditing && (
          <div className="mt-0.5 text-[13px] text-gray-400">No qty</div>
        )}
      </div>

      <ExpiryBadge expiryDate={item.expiry_date} showDate />

      {!isSelectMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
