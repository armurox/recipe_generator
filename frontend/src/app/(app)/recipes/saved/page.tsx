"use client";

import { RecipeCard } from "@/components/recipe-card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import type { PaginatedResponse, RecipeSummary, SavedRecipe } from "@/types/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function useSavedRecipes() {
  return useQuery({
    queryKey: ["recipes", "saved"],
    queryFn: () => apiClient.get<PaginatedResponse<SavedRecipe>>("/recipes/saved"),
    staleTime: 2 * 60 * 1000,
  });
}

function savedToSummary(saved: SavedRecipe): RecipeSummary {
  return {
    id: saved.recipe.id,
    external_id: saved.recipe.external_id ?? saved.recipe.id,
    source: saved.recipe.source,
    title: saved.recipe.title,
    image_url: saved.recipe.image_url,
    used_ingredient_count: 0,
    missed_ingredient_count: 0,
    used_ingredients: [],
    missed_ingredients: [],
    is_saved: true,
  };
}

export default function SavedRecipesPage() {
  const router = useRouter();
  const { data, isLoading } = useSavedRecipes();

  const recipes = data?.items.map(savedToSummary);

  return (
    <div>
      <div className="flex items-center gap-3 px-5 pb-4 pt-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold">Saved Recipes</h1>
      </div>

      <div className="px-5">
        {isLoading ? (
          <div>
            <Skeleton className="mb-4 h-[260px] rounded-xl" />
            <Skeleton className="mb-4 h-[260px] rounded-xl" />
          </div>
        ) : !recipes || recipes.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <BookOpen className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-[15px] font-medium text-gray-700">No saved recipes yet</p>
            <p className="mt-1 text-[13px] text-gray-500">
              Tap the heart on any recipe to save it here
            </p>
            <Link
              href="/recipes"
              className="mt-4 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-medium text-white"
            >
              Browse recipes
            </Link>
          </div>
        ) : (
          <div>
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.external_id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
