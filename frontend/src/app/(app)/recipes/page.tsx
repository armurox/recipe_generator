"use client";

import { useDebouncedValue } from "@/hooks/use-debounce";
import { useRecipeSearch, useRecipeSuggestions } from "@/hooks/use-recipes";
import { Heart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RecipeFilters } from "./_components/recipe-filters";
import { RecipeList } from "./_components/recipe-list";
import { RecipeSearch } from "./_components/recipe-search";

const FETCH_COUNT = 20;

export default function RecipesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("for-you");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Derive the effective search query and diet from filter + search input
  const isSearchMode = debouncedSearch.trim().length > 0 || activeFilter !== "for-you";
  let searchQuery = debouncedSearch;
  let dietFilter: string | undefined;

  if (!debouncedSearch && activeFilter === "quick") searchQuery = "quick easy";
  if (!debouncedSearch && activeFilter === "healthy") searchQuery = "healthy";
  if (activeFilter === "vegetarian") dietFilter = "vegetarian";

  const suggestions = useRecipeSuggestions(FETCH_COUNT);
  const search = useRecipeSearch(searchQuery, dietFilter);

  function handleFilterSelect(key: string) {
    setActiveFilter(key);
    if (key === "for-you") setSearchInput("");
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (value) setActiveFilter("for-you");
  }

  const showingSuggestions = !isSearchMode;

  return (
    <div>
      <div className="flex items-center justify-between px-5 pb-2 pt-3">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900">Recipes</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {showingSuggestions ? "Based on your pantry" : "Search results"}
          </p>
        </div>
        <Link
          href="/recipes/saved"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100"
        >
          <Heart className="h-5 w-5 text-gray-600" />
        </Link>
      </div>

      <div className="px-5">
        <RecipeSearch value={searchInput} onChange={handleSearchChange} />
        <RecipeFilters active={activeFilter} onSelect={handleFilterSelect} />

        {showingSuggestions ? (
          <>
            <div className="mb-3">
              <h2 className="text-[15px] font-semibold">
                {suggestions.data?.using_pantry_ingredients ? "Best matches" : "Popular recipes"}
              </h2>
              <p className="text-[13px] text-gray-500">
                {suggestions.data?.using_pantry_ingredients
                  ? "Using your pantry ingredients"
                  : "Add ingredients to get personalized suggestions"}
              </p>
            </div>
            <RecipeList
              recipes={suggestions.data?.items}
              isLoading={suggestions.isLoading}
              emptyTitle="No suggestions yet"
              emptySubtitle="Scan a receipt to add ingredients"
              showScanCTA
            />
          </>
        ) : (
          <RecipeList
            recipes={search.data?.items}
            isLoading={search.isLoading}
            emptyTitle={`No recipes found${debouncedSearch ? ` for "${debouncedSearch}"` : ""}`}
            emptySubtitle="Try a different search term or filter"
          />
        )}
      </div>
    </div>
  );
}
