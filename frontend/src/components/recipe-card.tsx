"use client";

import { useSaveRecipe, useUnsaveRecipe } from "@/hooks/use-recipes";
import type { RecipeSummary } from "@/types/api";
import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type RecipeCardProps = {
  recipe: RecipeSummary;
};

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

export function RecipeCard({ recipe }: RecipeCardProps) {
  const totalIngredients = recipe.used_ingredient_count + recipe.missed_ingredient_count;
  const recipeId = recipe.id ?? recipe.external_id;
  const saveMutation = useSaveRecipe();
  const unsaveMutation = useUnsaveRecipe();

  function handleSaveToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (recipe.is_saved) {
      unsaveMutation.mutate(recipeId);
    } else {
      saveMutation.mutate({ recipeId });
    }
  }

  return (
    <Link href={`/recipes/${recipeId}`} className="block">
      <div className="mb-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="relative h-[180px] w-full">
          {recipe.image_url ? (
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="(max-width: 448px) 100vw, 448px"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${getGradient(recipe.title)} text-5xl`}
            >
              🍽
            </div>
          )}
          {totalIngredients > 0 && (
            <div className="absolute right-3 top-3 rounded-full bg-green-700 px-2.5 py-1 text-xs font-semibold text-white">
              {recipe.used_ingredient_count}/{totalIngredients} match
            </div>
          )}
          <button
            type="button"
            onClick={handleSaveToggle}
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90"
          >
            <Heart
              size={18}
              className={recipe.is_saved ? "fill-red-500 text-red-500" : "text-gray-600"}
            />
          </button>
        </div>

        <div className="px-4 py-3.5">
          <h3 className="mb-1.5 text-base font-semibold">{recipe.title}</h3>
          {(recipe.used_ingredients.length > 0 || recipe.missed_ingredients.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.used_ingredients.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"
                >
                  {name}
                </span>
              ))}
              {recipe.missed_ingredients.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
