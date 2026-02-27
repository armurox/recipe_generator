import { ApiError } from "@/lib/api-error";
import { makeQueryClient } from "@/lib/query-client";
import { describe, expect, it, vi } from "vitest";

describe("makeQueryClient", () => {
  it("calls onUnauthorized when a mutation throws 401", async () => {
    const onUnauthorized = vi.fn();
    const queryClient = makeQueryClient(onUnauthorized);

    // Execute a mutation that throws a 401 ApiError
    try {
      await queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationFn: () => Promise.reject(new ApiError(401, "Unauthorized")),
        })
        .execute(undefined);
    } catch {
      // Expected to throw
    }

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does not call onUnauthorized for non-401 errors", async () => {
    const onUnauthorized = vi.fn();
    const queryClient = makeQueryClient(onUnauthorized);

    try {
      await queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationFn: () => Promise.reject(new ApiError(500, "Server error")),
        })
        .execute(undefined);
    } catch {
      // Expected to throw
    }

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not call onUnauthorized for generic errors", async () => {
    const onUnauthorized = vi.fn();
    const queryClient = makeQueryClient(onUnauthorized);

    try {
      await queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationFn: () => Promise.reject(new Error("Network error")),
        })
        .execute(undefined);
    } catch {
      // Expected to throw
    }

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
