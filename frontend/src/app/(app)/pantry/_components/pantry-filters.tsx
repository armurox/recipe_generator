"use client";

import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "expiring", label: "Expiring" },
  { key: "expired", label: "Expired" },
] as const;

export type PantryFilter = (typeof FILTERS)[number]["key"];

type PantryFiltersProps = {
  active: PantryFilter;
  onChange: (filter: PantryFilter) => void;
};

export function PantryFilters({ active, onChange }: PantryFiltersProps) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto">
      {FILTERS.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onChange(filter.key)}
          className={cn(
            "whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium",
            active === filter.key ? "bg-green-700 text-white" : "bg-gray-100 text-gray-700",
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
