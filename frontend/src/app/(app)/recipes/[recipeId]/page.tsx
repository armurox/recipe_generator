"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useRecipeDetail } from "@/hooks/use-recipes";
import { useParams } from "next/navigation";
import { IngredientsChecklist } from "./_components/ingredients-checklist";
import { InstructionsList } from "./_components/instructions-list";
import { NutritionGrid } from "./_components/nutrition-grid";
import { RecipeActions } from "./_components/recipe-actions";
import { RecipeHero } from "./_components/recipe-hero";
import { RecipeInfoCard } from "./_components/recipe-info-card";

type Ingredient = {
  name: string;
  amount: number | null;
  unit: string;
  original: string;
};

type Instruction = {
  step: number | null;
  text: string;
};

export default function RecipeDetailPage() {
  const params = useParams<{ recipeId: string }>();
  const { data: recipe, isLoading } = useRecipeDetail(params.recipeId);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-[280px] w-full" />
        <div className="space-y-4 px-5 pt-5">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-60 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-[15px] font-medium text-gray-700">Recipe not found</p>
        <p className="mt-1 text-[13px] text-gray-500">This recipe may no longer be available</p>
      </div>
    );
  }

  const ingredients = recipe.ingredients_json as Ingredient[];
  const instructions = recipe.instructions as Instruction[];
  const nutrition = recipe.nutrition as Record<string, { amount: number; unit: string }> | null;

  // Derive used ingredients from ingredients that match pantry (same data as RecipeSummary)
  // The detail endpoint doesn't return used_ingredients separately, so we pass an empty array.
  // The IngredientsChecklist will show all as "need" unless we cross-reference with pantry.
  const usedIngredients: string[] = [];

  const totalIngredients = ingredients.length;
  const recipeId = recipe.id ?? recipe.external_id ?? params.recipeId;

  return (
    <div className="pb-10">
      <RecipeHero
        title={recipe.title}
        imageUrl={recipe.image_url}
        isSaved={recipe.is_saved}
        recipeId={recipeId}
      />

      <div className="px-5 pt-5">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">{recipe.title}</h1>
        {recipe.description && (
          <p className="mb-4 text-sm leading-relaxed text-gray-500">{recipe.description}</p>
        )}

        <div className="mb-5 flex gap-3">
          {totalIngredients > 0 && (
            <span className="rounded-full bg-green-100 px-3.5 py-1.5 text-[13px] font-medium text-green-700">
              {totalIngredients} ingredients
            </span>
          )}
          {recipe.difficulty && (
            <span className="rounded-full bg-orange-100 px-3.5 py-1.5 text-[13px] font-medium text-orange-500">
              {recipe.difficulty}
            </span>
          )}
        </div>

        <NutritionGrid nutrition={nutrition} />
        <RecipeInfoCard
          prepTime={recipe.prep_time_minutes}
          cookTime={recipe.cook_time_minutes}
          servings={recipe.servings}
        />
        <IngredientsChecklist ingredients={ingredients} usedIngredients={usedIngredients} />
        <InstructionsList instructions={instructions} />
        <RecipeActions recipeId={recipeId} isSaved={recipe.is_saved} />
      </div>
    </div>
  );
}
