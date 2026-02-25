"use client";

import { RecipeCard } from "@/components/recipe-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecipeSummary } from "@/types/api";
import { BookOpen } from "lucide-react";
import Link from "next/link";

type RecipeListProps = {
  recipes: RecipeSummary[] | undefined;
  isLoading: boolean;
  emptyTitle: string;
  emptySubtitle: string;
  showScanCTA?: boolean;
};

export function RecipeList({
  recipes,
  isLoading,
  emptyTitle,
  emptySubtitle,
  showScanCTA,
}: RecipeListProps) {
  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-4 h-[260px] rounded-xl" />
        <Skeleton className="mb-4 h-[260px] rounded-xl" />
      </div>
    );
  }

  if (!recipes || recipes.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <BookOpen className="mb-3 h-12 w-12 text-gray-300" />
        <p className="text-[15px] font-medium text-gray-700">{emptyTitle}</p>
        <p className="mt-1 text-[13px] text-gray-500">{emptySubtitle}</p>
        {showScanCTA && (
          <Link
            href="/scan"
            className="mt-4 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-medium text-white"
          >
            Scan a receipt
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.external_id} recipe={recipe} />
      ))}
    </div>
  );
}
