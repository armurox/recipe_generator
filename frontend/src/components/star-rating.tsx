"use client";

import { Star } from "lucide-react";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
};

export function StarRating({ value, onChange, size = 24 }: StarRatingProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          disabled={!onChange}
          className="disabled:cursor-default"
        >
          <Star
            size={size}
            className={
              star <= value ? "fill-yellow-400 text-yellow-400" : "fill-none text-gray-300"
            }
          />
        </button>
      ))}
    </div>
  );
}
