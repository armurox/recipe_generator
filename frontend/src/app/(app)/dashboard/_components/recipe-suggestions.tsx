"use client";

import { RecipeCard } from "@/components/recipe-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecipeSuggestions } from "@/hooks/use-recipes";

export function RecipeSuggestions() {
  const { data: recipes, isLoading } = useRecipeSuggestions(2);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-2 h-6 w-40" />
        <Skeleton className="mb-1 h-4 w-56" />
        <Skeleton className="mt-3 h-[220px] rounded-xl" />
      </div>
    );
  }

  if (!recipes || recipes.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="mt-2 text-lg font-bold">Use it or lose it</h2>
      <p className="mb-3 text-[13px] text-gray-500">Recipes using your expiring items</p>
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.external_id} recipe={recipe} />
      ))}
    </div>
  );
}
