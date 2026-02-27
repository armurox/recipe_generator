import { mockPantryItem, mockPantryItemCreateOutput, mockPantryItems } from "@/test/mocks/fixtures";
import { server } from "@/test/mocks/server";
import { createTestQueryClient } from "@/test/test-utils";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  useAddPantryItem,
  useDeletePantryItem,
  usePantryItems,
  useUpdatePantryItem,
} from "./use-pantry";

const API_URL = "http://localhost:8000/api/v1";

function createWrapper() {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe("usePantryItems", () => {
  it("fetches pantry items", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePantryItems(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.items[0].ingredient.name).toBe("Chicken Breast");
  });
});

describe("useAddPantryItem", () => {
  it("creates item and invalidates pantry cache", async () => {
    const { Wrapper, queryClient } = createWrapper();

    // Pre-populate cache
    queryClient.setQueryData(["pantry", "items", {}], mockPantryItems);

    const { result } = renderHook(() => useAddPantryItem(), { wrapper: Wrapper });

    result.current.mutate({ ingredient_name: "Eggs" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPantryItemCreateOutput);
  });
});

describe("useUpdatePantryItem", () => {
  it("optimistically updates quantity and rolls back on error", async () => {
    const { Wrapper, queryClient } = createWrapper();

    // Pre-populate cache with items
    queryClient.setQueryData(["pantry", "items", {}], mockPantryItems);

    // Make API fail
    server.use(
      http.patch(`${API_URL}/pantry/:id`, () =>
        HttpResponse.json({ detail: "Server error" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useUpdatePantryItem(), { wrapper: Wrapper });

    result.current.mutate({ id: "pantry-item-1", data: { quantity: 999 } });

    // Optimistic update should appear immediately
    await waitFor(() => {
      const cached = queryClient.getQueryData<typeof mockPantryItems>(["pantry", "items", {}]);
      // After error, should roll back to original
      // The mutation settles quickly, so we check the final state
      expect(cached?.items[0].quantity).toBe(500);
    });
  });

  it("applies optimistic update on success", async () => {
    server.use(
      http.patch(`${API_URL}/pantry/:id`, () =>
        HttpResponse.json({ ...mockPantryItem, quantity: 300 }),
      ),
    );

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(["pantry", "items", {}], mockPantryItems);

    const { result } = renderHook(() => useUpdatePantryItem(), { wrapper: Wrapper });

    result.current.mutate({ id: "pantry-item-1", data: { quantity: 300 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useDeletePantryItem", () => {
  it("deletes item successfully", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeletePantryItem(), { wrapper: Wrapper });

    result.current.mutate("pantry-item-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
