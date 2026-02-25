"use client";

import { RecipeCard } from "@/components/recipe-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounce";
import {
  useInfiniteRecipeSearch,
  useInfiniteRecipeSuggestions,
  usePrefetchRecipeTabs,
} from "@/hooks/use-recipes";
import type { RecipeSummary } from "@/types/api";
import { BookOpen, Heart, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { RecipeFilters } from "./_components/recipe-filters";
import { RecipeSearch } from "./_components/recipe-search";

const PAGE_SIZE = 10;
// Prefetch well ahead — ~3 cards before the end so the next page is ready
const SCROLL_ROOT_MARGIN = "1200px";

// ---------------------------------------------------------------------------
// Infinite scroll via callback ref — fires exactly when the DOM node appears
// ---------------------------------------------------------------------------

function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node || !hasNextPage || isFetchingNextPage) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) fetchNextPage();
        },
        { rootMargin: SCROLL_ROOT_MARGIN },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  return sentinelRef;
}

// ---------------------------------------------------------------------------
// Client-side filter: instant feedback from already-loaded suggestions
// ---------------------------------------------------------------------------

function filterRecipesLocally(recipes: RecipeSummary[], query: string): RecipeSummary[] {
  if (!query) return recipes;

  const q = query.toLowerCase();
  return recipes.filter((recipe) => {
    const titleMatch = recipe.title.toLowerCase().includes(q);
    const ingredientMatch = [...recipe.used_ingredients, ...recipe.missed_ingredients].some((i) =>
      i.toLowerCase().includes(q),
    );
    return titleMatch || ingredientMatch;
  });
}

// Deduplicate: server results are authoritative, append client-only items
function mergeRecipes(clientItems: RecipeSummary[], serverItems: RecipeSummary[]): RecipeSummary[] {
  const seen = new Set(serverItems.map((r) => r.external_id));
  const extra = clientItems.filter((r) => !seen.has(r.external_id));
  return [...serverItems, ...extra];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RecipesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("for-you");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Derive the effective search query and diet from filter + search input
  const isSearchMode = debouncedSearch.trim().length > 0 || activeFilter !== "for-you";
  let searchQuery = debouncedSearch;
  let dietFilter: string | undefined;
  let maxReadyTime: number | undefined;

  if (!debouncedSearch && activeFilter === "quick") maxReadyTime = 30;
  if (!debouncedSearch && activeFilter === "healthy") searchQuery = "healthy";
  if (activeFilter === "vegetarian") dietFilter = "vegetarian";

  // Prefetch other tabs on mount so switching feels instant
  usePrefetchRecipeTabs(PAGE_SIZE);

  // Both queries always run — suggestions for client-side fallback, search for BE results
  const suggestions = useInfiniteRecipeSuggestions(PAGE_SIZE);
  const search = useInfiniteRecipeSearch(searchQuery, dietFilter, PAGE_SIZE, maxReadyTime);

  const allSuggestions = useMemo(
    () => suggestions.data?.pages.flatMap((p) => p.items) ?? [],
    [suggestions.data],
  );
  const allSearchResults = useMemo(
    () => search.data?.pages.flatMap((p) => p.items) ?? [],
    [search.data],
  );
  const usingPantry = suggestions.data?.pages[0]?.using_pantry_ingredients ?? false;

  // Layer 1: Client-side instant filter from already-loaded suggestions
  const clientFiltered = useMemo(
    () => (isSearchMode ? filterRecipesLocally(allSuggestions, searchQuery) : []),
    [allSuggestions, searchQuery, isSearchMode],
  );

  // Layer 2: Merge — server results take priority, append unique client matches
  const displayItems = useMemo(() => {
    if (!isSearchMode) return [];
    if (allSearchResults.length > 0) return mergeRecipes(clientFiltered, allSearchResults);
    return clientFiltered;
  }, [isSearchMode, clientFiltered, allSearchResults]);

  // Smart loading: only show skeleton when client has nothing AND server is still loading
  const isSearching = search.isFetching && !search.isFetchingNextPage;
  const showSearchSkeleton = isSearchMode && clientFiltered.length === 0 && search.isLoading;

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
                {usingPantry ? "Best matches" : "Popular recipes"}
              </h2>
              <p className="text-[13px] text-gray-500">
                {usingPantry
                  ? "Using your pantry ingredients"
                  : "Add ingredients to your pantry to get personalized suggestions"}
              </p>
            </div>
            <InfiniteRecipeList
              recipes={allSuggestions}
              isLoading={suggestions.isLoading}
              isFetchingNextPage={suggestions.isFetchingNextPage}
              hasNextPage={suggestions.hasNextPage}
              fetchNextPage={suggestions.fetchNextPage}
              emptyTitle="No suggestions yet"
              emptySubtitle="Scan a receipt to add ingredients"
              showScanCTA
            />
          </>
        ) : (
          <SearchResultsList
            recipes={displayItems}
            isLoading={showSearchSkeleton}
            isSearching={isSearching}
            isFetchingNextPage={search.isFetchingNextPage}
            hasNextPage={search.hasNextPage}
            fetchNextPage={search.fetchNextPage}
            searchComplete={search.isFetched}
            query={debouncedSearch}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search results with merge feedback + infinite scroll
// ---------------------------------------------------------------------------

function SearchResultsList({
  recipes,
  isLoading,
  isSearching,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  searchComplete,
  query,
}: {
  recipes: RecipeSummary[];
  isLoading: boolean;
  isSearching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  searchComplete: boolean;
  query: string;
}) {
  const sentinelRef = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage });

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-4 h-[260px] rounded-xl" />
        <Skeleton className="mb-4 h-[260px] rounded-xl" />
      </div>
    );
  }

  if (recipes.length === 0 && searchComplete) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <BookOpen className="mb-3 h-12 w-12 text-gray-300" />
        <p className="text-[15px] font-medium text-gray-700">
          {query ? `No recipes found for "${query}"` : "No recipes found"}
        </p>
        <p className="mt-1 text-[13px] text-gray-500">Try a different search term or filter</p>
      </div>
    );
  }

  return (
    <div>
      <div className={isSearching ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {recipes.map((recipe, i) => (
          <RecipeCard key={`${recipe.external_id}-${i}`} recipe={recipe} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {(isFetchingNextPage || isSearching) && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Infinite scroll list (For You suggestions)
// ---------------------------------------------------------------------------

function InfiniteRecipeList({
  recipes,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  emptyTitle,
  emptySubtitle,
  showScanCTA,
}: {
  recipes: RecipeSummary[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  emptyTitle: string;
  emptySubtitle: string;
  showScanCTA?: boolean;
}) {
  const sentinelRef = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage });

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-4 h-[260px] rounded-xl" />
        <Skeleton className="mb-4 h-[260px] rounded-xl" />
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <BookOpen className="mb-3 h-12 w-12 text-gray-300" />
        <p className="text-[15px] font-medium text-gray-700">{emptyTitle}</p>
        <p className="mt-1 text-[13px] text-gray-500">{emptySubtitle}</p>
        {showScanCTA && (
          <Link
            href="/scan"
            className="mt-4 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-medium text-white"
          >
            Scan a receipt
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      {recipes.map((recipe, i) => (
        <RecipeCard key={`${recipe.external_id}-${i}`} recipe={recipe} />
      ))}
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}
