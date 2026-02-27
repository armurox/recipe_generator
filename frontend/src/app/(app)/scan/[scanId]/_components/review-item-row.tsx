"use client";

import { X } from "lucide-react";
import type { UseFormRegister } from "react-hook-form";
import type { ReviewFormValues } from "../page";

const UNIT_OPTIONS = ["pcs", "g", "kg", "ml", "L", "oz", "lb"];

type ReviewItemRowProps = {
  index: number;
  ingredientName: string | null;
  register: UseFormRegister<ReviewFormValues>;
  onRemove: () => void;
};

function getConfidenceColor(ingredientName: string | null): string {
  if (!ingredientName) return "bg-red-500";
  // Short or all-caps names suggest abbreviation
  if (ingredientName.length <= 4 || ingredientName === ingredientName.toUpperCase()) {
    return "bg-yellow-500";
  }
  return "bg-green-500";
}

export function ReviewItemRow({ index, ingredientName, register, onRemove }: ReviewItemRowProps) {
  const dotColor = getConfidenceColor(ingredientName);
  const isLowConfidence = dotColor === "bg-red-500";

  return (
    <div className="flex items-center gap-2.5 border-b border-gray-100 py-3 last:border-b-0">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      <input
        {...register(`items.${index}.ingredient_name`)}
        className={`min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none ${
          isLowConfidence ? "text-orange-500" : "text-gray-900"
        }`}
      />
      <input
        {...register(`items.${index}.quantity`)}
        type="number"
        step="any"
        className="w-[60px] rounded-lg border-[1.5px] border-gray-300 px-2 py-1.5 text-center text-[14px]"
      />
      <select
        {...register(`items.${index}.unit`)}
        className="w-[56px] rounded-lg border-[1.5px] border-gray-300 bg-white px-1 py-1.5 text-center text-[13px]"
      >
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
