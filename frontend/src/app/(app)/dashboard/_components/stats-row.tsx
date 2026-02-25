"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { usePantrySummary } from "@/hooks/use-pantry";

export function StatsRow() {
  const { data, isLoading } = usePantrySummary();

  if (isLoading) {
    return (
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
    );
  }

  const stats = [
    { value: data?.total_available ?? 0, label: "ITEMS", color: "text-green-700" },
    { value: data?.total_expiring_soon ?? 0, label: "EXPIRING", color: "text-orange-500" },
    { value: data?.total_expired ?? 0, label: "EXPIRED", color: "text-red-500" },
  ];

  return (
    <div className="mb-4 grid grid-cols-3 gap-2.5">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl bg-white px-3 py-3.5 text-center shadow-sm">
          <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          <div className="mt-1 text-[11px] font-medium text-gray-500">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
