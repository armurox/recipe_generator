import "@/test/mocks/next-mocks";
import { mockRecipeSummary, mockRecipeSummarySaved } from "@/test/mocks/fixtures";
import { renderWithClient } from "@/test/test-utils";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecipeCard } from "./recipe-card";

// Mock the save/unsave hooks
const mutateSave = vi.fn();
const mutateUnsave = vi.fn();

vi.mock("@/hooks/use-recipes", () => ({
  useSaveRecipe: () => ({ mutate: mutateSave }),
  useUnsaveRecipe: () => ({ mutate: mutateUnsave }),
}));

describe("RecipeCard", () => {
  it("renders title and ingredient badges", () => {
    renderWithClient(<RecipeCard recipe={mockRecipeSummary} />);

    expect(screen.getByText("Grilled Chicken Salad")).toBeInTheDocument();
    expect(screen.getByText("Chicken Breast")).toBeInTheDocument();
    expect(screen.getByText("Lettuce")).toBeInTheDocument();
    expect(screen.getByText("Olive Oil")).toBeInTheDocument();
  });

  it("shows pantry match badge", () => {
    renderWithClient(<RecipeCard recipe={mockRecipeSummary} />);

    expect(screen.getByText("2/3 in pantry")).toBeInTheDocument();
  });

  it("links to correct detail URL", () => {
    renderWithClient(<RecipeCard recipe={mockRecipeSummary} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/recipes/recipe-1");
  });

  it("calls unsave when clicking heart on saved recipe", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecipeCard recipe={mockRecipeSummarySaved} />);

    const heartButton = screen.getByRole("button");
    await user.click(heartButton);

    expect(mutateUnsave).toHaveBeenCalledWith("recipe-2");
  });

  it("calls save when clicking heart on unsaved recipe", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecipeCard recipe={mockRecipeSummary} />);

    const heartButton = screen.getByRole("button");
    await user.click(heartButton);

    expect(mutateSave).toHaveBeenCalledWith({ recipeId: "recipe-1" });
  });
});
