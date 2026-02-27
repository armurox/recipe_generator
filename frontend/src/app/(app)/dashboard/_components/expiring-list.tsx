"use client";

import { ExpiryBadge } from "@/components/expiry-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpiringItems } from "@/hooks/use-pantry";
import Link from "next/link";

export function ExpiringList() {
  const { data: items, isLoading } = useExpiringItems(3);

  if (isLoading) {
    return (
      <div className="mb-3 rounded-xl bg-white p-4 shadow-sm">
        <Skeleton className="mb-3 h-5 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="mb-2 h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-base font-semibold">Expiring Soon</span>
        <Link href="/pantry" className="text-[13px] font-medium text-green-600">
          View all
        </Link>
      </div>

      {items.slice(0, 5).map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-b-0"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-[22px]">
            {item.ingredient.category_icon ?? "🥫"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium">{item.ingredient.name}</div>
            <div className="mt-0.5 text-[13px] text-gray-500">
              {item.quantity != null && item.unit
                ? `${item.quantity}${item.unit}`
                : item.quantity != null
                  ? `${item.quantity}`
                  : ""}
              {item.quantity != null ? " remaining" : ""}
            </div>
          </div>
          <ExpiryBadge expiryDate={item.expiry_date} />
        </div>
      ))}
    </div>
  );
}
