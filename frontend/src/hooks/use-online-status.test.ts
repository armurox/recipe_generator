import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOnlineStatus } from "./use-online-status";

describe("useOnlineStatus", () => {
  it("returns true by default", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("returns false after offline event", () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);

    // Restore
    act(() => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      window.dispatchEvent(new Event("online"));
    });
  });

  it("returns true after online event following offline", () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(true);
  });
});
