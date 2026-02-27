"use client";

import { RecipeCard } from "@/components/recipe-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecipeSuggestions } from "@/hooks/use-recipes";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 3;
const FETCH_COUNT = 12;

export function RecipeSuggestions() {
  const { data, isLoading } = useRecipeSuggestions(FETCH_COUNT);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = !!data && visible < data.items.length;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible((v) => v + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visible]);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-2 h-6 w-40" />
        <Skeleton className="mb-1 h-4 w-56" />
        <Skeleton className="mt-3 h-[220px] rounded-xl" />
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return null;
  }

  const recipes = data.items;
  const shown = recipes.slice(0, visible);

  return (
    <div>
      <h2 className="mt-2 text-lg font-bold">
        {data.using_pantry_ingredients ? "Suggested recipes" : "Popular recipes"}
      </h2>
      <p className="mb-3 text-[13px] text-gray-500">
        {data.using_pantry_ingredients
          ? "Based on what\u2019s in your pantry"
          : "Add ingredients to your pantry to get personalized suggestions"}
      </p>
      {shown.map((recipe) => (
        <RecipeCard key={recipe.external_id} recipe={recipe} />
      ))}
      {hasMore && <div ref={sentinelRef} className="h-1" />}
    </div>
  );
}
