"use client";

import { StarRating } from "@/components/star-rating";
import { useLogCooking, useSaveRecipe, useUnsaveRecipe } from "@/hooks/use-recipes";
import { CookingPot, Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type RecipeActionsProps = {
  recipeId: string;
  isSaved: boolean;
};

export function RecipeActions({ recipeId, isSaved }: RecipeActionsProps) {
  const [showCookDialog, setShowCookDialog] = useState(false);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");

  const saveMutation = useSaveRecipe();
  const unsaveMutation = useUnsaveRecipe();
  const cookMutation = useLogCooking();

  function handleSaveToggle() {
    if (isSaved) {
      unsaveMutation.mutate(recipeId);
    } else {
      saveMutation.mutate({ recipeId });
    }
  }

  function handleLogCooking() {
    cookMutation.mutate(
      {
        recipeId,
        input: {
          rating: rating || null,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Cooking logged!");
          setShowCookDialog(false);
          setRating(0);
          setNotes("");
        },
        onError: () => {
          toast.error("Failed to log cooking");
        },
      },
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowCookDialog(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3.5 text-base font-semibold text-white"
        >
          <CookingPot size={20} />I Cooked This
        </button>
        <button
          type="button"
          onClick={handleSaveToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-100 px-6 py-3.5 text-base font-semibold text-green-700 transition-colors hover:bg-green-200 active:bg-green-200/80"
        >
          <Heart
            size={20}
            className={`transition-colors ${isSaved ? "fill-red-500 text-red-500" : ""}`}
          />
          {isSaved ? "Saved" : "Save Recipe"}
        </button>
      </div>

      {showCookDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowCookDialog(false)}
        >
          <div
            className="w-64 rounded-2xl bg-white px-5 pb-5 pt-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-0.5 text-center text-base font-bold">How was it?</h3>
            <p className="mb-3 text-center text-[13px] text-gray-500">
              Rate your cooking experience
            </p>

            <div className="mb-3 flex justify-center">
              <StarRating value={rating} onChange={setRating} size={28} />
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes? (optional)"
              className="mb-4 h-20 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-green-500"
            />

            <button
              type="button"
              onClick={handleLogCooking}
              disabled={cookMutation.isPending}
              className="w-full rounded-xl bg-green-700 py-2.5 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {cookMutation.isPending ? "Saving..." : "Log Cooking"}
            </button>
            <button
              type="button"
              onClick={() => setShowCookDialog(false)}
              className="mt-2 w-full rounded-xl py-2 text-[14px] font-medium text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
