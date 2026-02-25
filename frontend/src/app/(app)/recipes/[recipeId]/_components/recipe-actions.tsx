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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-100 px-6 py-3.5 text-base font-semibold text-green-700"
        >
          <Heart size={20} className={isSaved ? "fill-red-500 text-red-500" : ""} />
          {isSaved ? "Saved" : "Save Recipe"}
        </button>
      </div>

      {showCookDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl bg-white px-5 pb-8 pt-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-bold">How was it?</h3>
              <button
                type="button"
                onClick={() => setShowCookDialog(false)}
                className="text-sm text-gray-500"
              >
                Cancel
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500">Rate your cooking experience</p>

            <div className="mb-4 flex justify-center">
              <StarRating value={rating} onChange={setRating} size={32} />
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes? (optional)"
              className="mb-4 h-24 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-green-500"
            />

            <button
              type="button"
              onClick={handleLogCooking}
              disabled={cookMutation.isPending}
              className="w-full rounded-xl bg-green-700 py-3.5 text-base font-semibold text-white disabled:opacity-50"
            >
              {cookMutation.isPending ? "Saving..." : "Log Cooking"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
