"use client";

import { Search } from "lucide-react";

type PantrySearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function PantrySearch({ value, onChange }: PantrySearchProps) {
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3">
      <Search className="h-[18px] w-[18px] text-gray-500" />
      <input
        type="text"
        placeholder="Search pantry items..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-gray-400"
      />
    </div>
  );
}
