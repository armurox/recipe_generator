"use client";

import { useSaveRecipe, useUnsaveRecipe } from "@/hooks/use-recipes";
import { ArrowLeft, Heart, Share2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type RecipeHeroProps = {
  title: string;
  imageUrl: string | null;
  isSaved: boolean;
  recipeId: string;
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

export function RecipeHero({ title, imageUrl, isSaved, recipeId }: RecipeHeroProps) {
  const router = useRouter();
  const saveMutation = useSaveRecipe();
  const unsaveMutation = useUnsaveRecipe();

  function handleSaveToggle() {
    if (isSaved) {
      unsaveMutation.mutate(recipeId);
    } else {
      saveMutation.mutate({ recipeId });
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  }

  return (
    <div className="relative h-[280px] w-full">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 448px) 100vw, 448px"
          priority
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${getGradient(title)} text-7xl`}
        >
          🍽
        </div>
      )}
      <div className="absolute left-0 right-0 top-0 flex justify-between px-5 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90"
        >
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleSaveToggle}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90"
          >
            <Heart size={20} className={isSaved ? "fill-red-500 text-red-500" : "text-gray-600"} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90"
          >
            <Share2 size={20} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
