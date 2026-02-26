import "@/test/mocks/next-mocks";
import { renderWithClient } from "@/test/test-utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddItemDialog } from "./add-item-dialog";

// Mock the hooks
const mutateAsyncMock = vi.fn().mockResolvedValue({ item: {}, created: true });
vi.mock("@/hooks/use-pantry", () => ({
  useAddPantryItem: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  usePantrySummary: () => ({
    data: {
      categories: [
        { category_name: "Dairy" },
        { category_name: "Meat" },
        { category_name: "Uncategorized" },
      ],
    },
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("AddItemDialog", () => {
  it("renders form fields when open", () => {
    const onOpenChange = vi.fn();
    renderWithClient(<AddItemDialog open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByPlaceholderText("e.g. Chicken Breast")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("500")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("g")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Dairy")).toBeInTheDocument();
    expect(screen.getByText("Add Item")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("submit button is disabled when name is empty", () => {
    const onOpenChange = vi.fn();
    renderWithClient(<AddItemDialog open={true} onOpenChange={onOpenChange} />);

    const submitBtn = screen.getByText("Add Item");
    expect(submitBtn).toBeDisabled();
  });

  it("submits with form data", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithClient(<AddItemDialog open={true} onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText("e.g. Chicken Breast"), "Eggs");
    await user.type(screen.getByPlaceholderText("500"), "12");
    await user.type(screen.getByPlaceholderText("g"), "pcs");

    const submitBtn = screen.getByText("Add Item");
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        ingredient_name: "Eggs",
        quantity: 12,
        unit: "pcs",
        expiry_date: null,
        category_hint: null,
      });
    });
  });

  it("cancel calls onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithClient(<AddItemDialog open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText("Cancel"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
