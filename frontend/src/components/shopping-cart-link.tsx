"use client";

import { usePantrySummary } from "@/hooks/use-pantry";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

export function ShoppingCartLink() {
  const { data: summary } = usePantrySummary();
  const count = summary?.total_to_buy ?? 0;

  return (
    <Link
      href="/pantry?view=shopping"
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600"
    >
      <ShoppingCart className="h-4.5 w-4.5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
