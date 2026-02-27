import { mockUser } from "@/test/mocks/fixtures";
import { createTestQueryClient } from "@/test/test-utils";
import type { User } from "@/types/api";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCurrentUser, useUpdateUser } from "./use-user";

function createWrapper() {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe("useCurrentUser", () => {
  it("fetches user profile", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCurrentUser(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.email).toBe("test@example.com");
    expect(result.current.data?.display_name).toBe("Test User");
  });
});

describe("useUpdateUser", () => {
  it("updates user and sets cache directly", async () => {
    const { Wrapper, queryClient } = createWrapper();

    // Seed cache
    queryClient.setQueryData(["user", "me"], mockUser);

    const { result } = renderHook(() => useUpdateUser(), { wrapper: Wrapper });

    result.current.mutate({ display_name: "Updated Name" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<User>(["user", "me"]);
    expect(cached?.display_name).toBe("Updated Name");
  });
});
