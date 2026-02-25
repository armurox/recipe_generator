"use client";

import { Search, X } from "lucide-react";

type RecipeSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function RecipeSearch({ value, onChange }: RecipeSearchProps) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder="Search recipes..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-9 text-[15px] outline-none focus:border-green-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
