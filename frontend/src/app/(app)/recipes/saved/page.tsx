"use client";

import { StarRating } from "@/components/star-rating";
import { Skeleton } from "@/components/ui/skeleton";
import { useCookingHistory, useUnsaveRecipe } from "@/hooks/use-recipes";
import { apiClient } from "@/lib/api";
import type { CookingLog, PaginatedResponse, SavedRecipe } from "@/types/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Heart, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function useSavedRecipes() {
  return useQuery({
    queryKey: ["recipes", "saved"],
    queryFn: () => apiClient.get<PaginatedResponse<SavedRecipe>>("/recipes/saved"),
    staleTime: 2 * 60 * 1000,
  });
}

const GRADIENT_PALETTES = [
  "from-green-100 to-orange-100",
  "from-yellow-100 to-green-100",
  "from-orange-100 to-red-100",
  "from-green-100 to-yellow-100",
];

function getGradient(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PALETTES[Math.abs(hash) % GRADIENT_PALETTES.length];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SavedRecipeRow({ saved }: { saved: SavedRecipe }) {
  const unsaveMutation = useUnsaveRecipe();
  const recipe = saved.recipe;
  const recipeId = recipe.id ?? recipe.external_id;

  const meta: string[] = [];
  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  if (totalTime > 0) meta.push(`${totalTime} min`);
  if (recipe.servings) meta.push(`${recipe.servings} servings`);
  if (recipe.difficulty) meta.push(recipe.difficulty);

  function handleUnsave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (recipeId) unsaveMutation.mutate(recipeId);
  }

  return (
    <Link href={`/recipes/${recipeId}`} className="flex items-center gap-3 py-3">
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${getGradient(recipe.title)} text-2xl`}
          >
            🍽
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-gray-900">{recipe.title}</p>
        {meta.length > 0 && <p className="mt-0.5 text-[13px] text-gray-500">{meta.join(" · ")}</p>}
      </div>
      <button
        type="button"
        onClick={handleUnsave}
        className="flex-shrink-0 rounded-full p-2 transition-all hover:bg-red-50 active:scale-90"
        disabled={unsaveMutation.isPending}
      >
        <Heart size={18} className="fill-red-500 text-red-500 transition-colors" />
      </button>
    </Link>
  );
}

function CookingLogRow({ log }: { log: CookingLog }) {
  return (
    <Link href={`/recipes/${log.recipe_id}`} className="flex items-center gap-3 py-3">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl">
        {log.recipe_image_url ? (
          <Image
            src={log.recipe_image_url}
            alt={log.recipe_title}
            width={48}
            height={48}
            className="h-full w-full rounded-lg object-cover"
          />
        ) : (
          "🍽"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-gray-900">{log.recipe_title}</p>
        <p className="mt-0.5 text-[13px] text-gray-500">{formatDate(log.cooked_at)}</p>
      </div>
      {log.rating && (
        <div className="flex-shrink-0">
          <StarRating value={log.rating} size={14} />
        </div>
      )}
    </Link>
  );
}

export default function SavedRecipesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data: savedData, isLoading: savedLoading } = useSavedRecipes();
  const { data: historyData, isLoading: historyLoading } = useCookingHistory();

  const allSaved = savedData?.items ?? [];
  const filtered = search.trim()
    ? allSaved.filter((s) => s.recipe.title.toLowerCase().includes(search.toLowerCase()))
    : allSaved;

  const history = historyData?.items ?? [];

  return (
    <div className="pb-6">
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
        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search saved recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-[15px] outline-none focus:border-green-500"
          />
        </div>

        {savedLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <BookOpen className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-[15px] font-medium text-gray-700">
              {search.trim() ? "No matching recipes" : "No saved recipes yet"}
            </p>
            <p className="mt-1 text-[13px] text-gray-500">
              {search.trim()
                ? "Try a different search term"
                : "Tap the heart on any recipe to save it here"}
            </p>
            {!search.trim() && (
              <Link
                href="/recipes"
                className="mt-4 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-medium text-white"
              >
                Browse recipes
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mb-2 text-[13px] text-gray-500">
              {filtered.length} recipe{filtered.length !== 1 ? "s" : ""} saved
            </p>
            <div className="rounded-xl bg-white px-4 shadow-sm">
              {filtered.map((saved, i) => (
                <div
                  key={saved.id}
                  className={i < filtered.length - 1 ? "border-b border-gray-100" : ""}
                >
                  <SavedRecipeRow saved={saved} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Cooking History */}
        {(historyLoading || history.length > 0) && (
          <div className="mt-6">
            <h2 className="mb-0.5 text-base font-semibold text-gray-900">Recently Cooked</h2>
            <p className="mb-3 text-[13px] text-gray-500">Your cooking history</p>

            {historyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-white px-4 shadow-sm">
                {history.map((log, i) => (
                  <div
                    key={log.id}
                    className={i < history.length - 1 ? "border-b border-gray-100" : ""}
                  >
                    <CookingLogRow log={log} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
