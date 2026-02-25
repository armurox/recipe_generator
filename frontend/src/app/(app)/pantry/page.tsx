"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { usePantryItems, usePantrySummary } from "@/hooks/use-pantry";
import { useCurrentUser } from "@/hooks/use-user";
import type { PantryItem } from "@/types/api";
import { Camera } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryGroup } from "./_components/category-group";
import { PantryFilters, type PantryFilter } from "./_components/pantry-filters";
import { PantrySearch } from "./_components/pantry-search";

type GroupedItems = {
  categoryName: string;
  categoryIcon: string | null;
  items: PantryItem[];
};

function groupByCategory(items: PantryItem[]): GroupedItems[] {
  const groups = new Map<string, GroupedItems>();

  for (const item of items) {
    const name = item.ingredient.category_name ?? "Uncategorized";
    const icon = item.ingredient.category_icon;

    if (!groups.has(name)) {
      groups.set(name, { categoryName: name, categoryIcon: icon, items: [] });
    }
    groups.get(name)!.items.push(item);
  }

  // Sort groups alphabetically, items within group by expiry date (nulls last)
  const sorted = Array.from(groups.values()).sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName),
  );

  for (const group of sorted) {
    group.items.sort((a, b) => {
      if (!a.expiry_date && !b.expiry_date) return 0;
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });
  }

  return sorted;
}

export default function PantryPage() {
  const [filter, setFilter] = useState<PantryFilter>("all");
  const [search, setSearch] = useState("");
  const { data: user } = useCurrentUser();

  const queryFilters = useMemo(() => {
    if (filter === "available") return { status: "available" };
    if (filter === "expiring") return { status: "available", expiring_within: 3 };
    if (filter === "expired") return { status: "expired" };
    return {};
  }, [filter]);

  const { data, isLoading } = usePantryItems(queryFilters);
  const { data: summary } = usePantrySummary();

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.ingredient.name.toLowerCase().includes(q));
  }, [data?.items, search]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  const initial = user?.display_name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div>
      <div className="flex items-center justify-between px-5 pb-4 pt-3">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900">Pantry</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {summary ? `${summary.total_available} items tracked` : "Loading..."}
          </p>
        </div>
        <Link
          href="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-base font-semibold text-white"
        >
          {initial}
        </Link>
      </div>

      <div className="px-5 pb-24">
        <PantrySearch value={search} onChange={setSearch} />
        <PantryFilters active={filter} onChange={setFilter} />

        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="mb-2 h-5 w-32" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="mb-3 text-5xl">📦</div>
            <h2 className="mb-2 text-lg font-semibold">
              {search ? "No items found" : "Your pantry is empty"}
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              {search
                ? `No items matching "${search}"`
                : "Scan a receipt to start tracking your groceries"}
            </p>
            {!search && (
              <Link
                href="/scan"
                className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white"
              >
                <Camera className="h-4 w-4" />
                Scan Receipt
              </Link>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <CategoryGroup
              key={group.categoryName}
              categoryName={group.categoryName}
              categoryIcon={group.categoryIcon}
              items={group.items}
            />
          ))
        )}
      </div>
    </div>
  );
}
