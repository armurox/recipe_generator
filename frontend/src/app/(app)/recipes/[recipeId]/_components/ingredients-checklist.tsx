"use client";

import { Check, Circle } from "lucide-react";

type Ingredient = {
  name: string;
  amount: number | null;
  unit: string;
  original: string;
};

type IngredientsChecklistProps = {
  ingredients: Ingredient[];
  usedIngredients: string[];
};

export function IngredientsChecklist({ ingredients, usedIngredients }: IngredientsChecklistProps) {
  if (ingredients.length === 0) return null;

  const usedSet = new Set(usedIngredients.map((n) => n.toLowerCase()));

  return (
    <div className="mb-5">
      <h2 className="mb-3 text-lg font-bold">Ingredients</h2>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        {ingredients.map((ingredient, index) => {
          const inPantry = usedSet.has(ingredient.name.toLowerCase());
          const amountText =
            ingredient.amount != null
              ? `${ingredient.amount}${ingredient.unit ? ` ${ingredient.unit}` : ""}`
              : ingredient.unit || null;

          return (
            <div
              key={index}
              className={`flex items-center gap-3 py-2.5 ${
                index < ingredients.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {inPantry ? (
                <Check size={16} className="shrink-0 text-green-500" />
              ) : (
                <Circle size={16} className="shrink-0 text-gray-300" />
              )}
              <span
                className={inPantry ? "text-[15px] text-green-600" : "text-[15px] text-gray-500"}
              >
                {ingredient.name}
              </span>
              {amountText && (
                <span className="ml-auto text-[13px] text-gray-500">{amountText}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
