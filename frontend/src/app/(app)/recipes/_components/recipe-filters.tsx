"use client";

type Filter = {
  label: string;
  key: string;
};

const FILTERS: Filter[] = [
  { label: "For You", key: "for-you" },
  { label: "Quick Meals", key: "quick" },
  { label: "Vegetarian", key: "vegetarian" },
  { label: "Healthy", key: "healthy" },
];

type RecipeFiltersProps = {
  active: string;
  onSelect: (key: string) => void;
};

export function RecipeFilters({ active, onSelect }: RecipeFiltersProps) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onSelect(f.key)}
          className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
            active === f.key ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
