"use client";

import { useCurrentUser } from "@/hooks/use-user";
import { ExpiringList } from "./_components/expiring-list";
import { QuickActions } from "./_components/quick-actions";
import { RecipeSuggestions } from "./_components/recipe-suggestions";
import { StatsRow } from "./_components/stats-row";
import Link from "next/link";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 18) return "Good afternoon!";
  return "Good evening!";
}

export default function DashboardPage() {
  const { data: user } = useCurrentUser();

  const initial = user?.display_name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div>
      <div className="flex items-center justify-between px-5 pb-4 pt-3">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900">{getGreeting()}</h1>
          <p className="mt-0.5 text-sm text-gray-500">Here&apos;s your pantry overview</p>
        </div>
        <Link
          href="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-base font-semibold text-white"
        >
          {initial}
        </Link>
      </div>

      <div className="px-5 pb-24">
        <StatsRow />
        <QuickActions />
        <ExpiringList />
        <RecipeSuggestions />
      </div>
    </div>
  );
}
