import { mockRecipeDetail, mockSavedRecipes, mockSuggestResponse } from "@/test/mocks/fixtures";
import { server } from "@/test/mocks/server";
import { createTestQueryClient } from "@/test/test-utils";
import type { RecipeDetail, SuggestRecipesResponse } from "@/types/api";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useSaveRecipe, useUnsaveRecipe } from "./use-recipes";

// Mock sonner toast to avoid side effects
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const API_URL = "http://localhost:8000/api/v1";

function createWrapper() {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe("useSaveRecipe", () => {
  it("toggles is_saved optimistically in detail cache", async () => {
    const { Wrapper, queryClient } = createWrapper();

    // Seed detail cache
    queryClient.setQueryData(["recipes", "detail", "recipe-1"], mockRecipeDetail);

    const { result } = renderHook(() => useSaveRecipe(), { wrapper: Wrapper });

    result.current.mutate({ recipeId: "recipe-1" });

    // Optimistic update should flip is_saved immediately
    await waitFor(() => {
      const cached = queryClient.getQueryData<RecipeDetail>(["recipes", "detail", "recipe-1"]);
      expect(cached?.is_saved).toBe(true);
    });
  });

  it("toggles is_saved in suggest cache", async () => {
    const { Wrapper, queryClient } = createWrapper();

    // Seed suggest cache (non-infinite)
    queryClient.setQueryData(["recipes", "suggest", { pageSize: 10 }], mockSuggestResponse);

    const { result } = renderHook(() => useSaveRecipe(), { wrapper: Wrapper });

    result.current.mutate({ recipeId: "recipe-1" });

    await waitFor(() => {
      const cached = queryClient.getQueryData<SuggestRecipesResponse>([
        "recipes",
        "suggest",
        { pageSize: 10 },
      ]);
      const item = cached?.items.find((r) => r.id === "recipe-1");
      expect(item?.is_saved).toBe(true);
    });
  });

  it("rolls back on API failure", async () => {
    server.use(
      http.post(`${API_URL}/recipes/:id/save`, () =>
        HttpResponse.json({ detail: "Error" }, { status: 500 }),
      ),
    );

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(["recipes", "detail", "recipe-1"], mockRecipeDetail);

    const { result } = renderHook(() => useSaveRecipe(), { wrapper: Wrapper });

    result.current.mutate({ recipeId: "recipe-1" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Should roll back
    const cached = queryClient.getQueryData<RecipeDetail>(["recipes", "detail", "recipe-1"]);
    expect(cached?.is_saved).toBe(false);
  });
});

describe("useUnsaveRecipe", () => {
  it("removes from saved list optimistically", async () => {
    const { Wrapper, queryClient } = createWrapper();

    // Seed saved recipes cache
    queryClient.setQueryData(["recipes", "saved"], mockSavedRecipes);

    const { result } = renderHook(() => useUnsaveRecipe(), { wrapper: Wrapper });

    result.current.mutate("recipe-1");

    await waitFor(() => {
      const cached = queryClient.getQueryData<typeof mockSavedRecipes>(["recipes", "saved"]);
      expect(cached?.items).toHaveLength(0);
    });
  });

  it("rolls back on API failure", async () => {
    server.use(
      http.delete(`${API_URL}/recipes/:id/save`, () =>
        HttpResponse.json({ detail: "Error" }, { status: 500 }),
      ),
    );

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(["recipes", "saved"], mockSavedRecipes);

    const { result } = renderHook(() => useUnsaveRecipe(), { wrapper: Wrapper });

    result.current.mutate("recipe-1");

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Should roll back
    const cached = queryClient.getQueryData<typeof mockSavedRecipes>(["recipes", "saved"]);
    expect(cached?.items).toHaveLength(1);
  });
});
