"use client";

type NutritionData = Record<string, { amount: number; unit: string }>;

type NutritionGridProps = {
  nutrition: NutritionData | null;
};

const DISPLAY_NUTRIENTS = [
  { key: "calories", label: "kcal", format: (v: number) => Math.round(v).toString() },
  { key: "protein", label: "protein", format: (v: number) => `${Math.round(v)}g` },
  { key: "carbohydrates", label: "carbs", format: (v: number) => `${Math.round(v)}g` },
  { key: "fat", label: "fat", format: (v: number) => `${Math.round(v)}g` },
];

export function NutritionGrid({ nutrition }: NutritionGridProps) {
  if (!nutrition) return null;

  const hasAny = DISPLAY_NUTRIENTS.some((n) => nutrition[n.key]);
  if (!hasAny) return null;

  return (
    <div className="mb-5 grid grid-cols-4 gap-2">
      {DISPLAY_NUTRIENTS.map((nutrient) => {
        const data = nutrition[nutrient.key];
        return (
          <div key={nutrient.key} className="rounded-lg bg-gray-100 px-1 py-2.5 text-center">
            <div className="text-lg font-bold text-green-700">
              {data ? nutrient.format(data.amount) : "—"}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">{nutrient.label}</div>
          </div>
        );
      })}
    </div>
  );
}
