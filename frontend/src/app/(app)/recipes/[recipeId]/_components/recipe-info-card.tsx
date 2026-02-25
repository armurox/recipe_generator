"use client";

import { Clock, Flame, Users } from "lucide-react";

type RecipeInfoCardProps = {
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
};

export function RecipeInfoCard({ prepTime, cookTime, servings }: RecipeInfoCardProps) {
  if (!prepTime && !cookTime && !servings) return null;

  return (
    <div className="mb-5 rounded-xl bg-white p-4 shadow-sm">
      <div className="grid grid-cols-3 text-center">
        <div>
          <Clock size={20} className="mx-auto mb-1 text-gray-500" />
          <div className="text-sm font-semibold">{prepTime ? `${prepTime} min` : "—"}</div>
          <div className="text-[11px] text-gray-500">Prep</div>
        </div>
        <div className="border-x border-gray-100">
          <Flame size={20} className="mx-auto mb-1 text-gray-500" />
          <div className="text-sm font-semibold">{cookTime ? `${cookTime} min` : "—"}</div>
          <div className="text-[11px] text-gray-500">Cook</div>
        </div>
        <div>
          <Users size={20} className="mx-auto mb-1 text-gray-500" />
          <div className="text-sm font-semibold">{servings ?? "—"}</div>
          <div className="text-[11px] text-gray-500">Servings</div>
        </div>
      </div>
    </div>
  );
}
