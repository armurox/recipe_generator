import { render, screen, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfflineBanner } from "./offline-banner";

describe("OfflineBanner", () => {
  it("renders nothing when online", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders banner when offline", () => {
    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });

    render(<OfflineBanner />);
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();

    // Restore
    act(() => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      window.dispatchEvent(new Event("online"));
    });
  });
});
