import "@/test/mocks/next-mocks";
import { renderWithClient } from "@/test/test-utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddItemDialog } from "./add-item-dialog";

// Mock the hooks
const mutateAsyncMock = vi
  .fn()
  .mockResolvedValue({ created_count: 1, updated_count: 0, items: [] });
vi.mock("@/hooks/use-pantry", () => ({
  useBulkAddPantryItems: () => ({
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
    expect(screen.getByPlaceholderText("Dairy")).toBeInTheDocument();
    expect(screen.getByText("Add 0 Items")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Add Row")).toBeInTheDocument();
  });

  it("submit button is disabled when name is empty", () => {
    const onOpenChange = vi.fn();
    renderWithClient(<AddItemDialog open={true} onOpenChange={onOpenChange} />);

    const submitBtn = screen.getByText("Add 0 Items");
    expect(submitBtn).toBeDisabled();
  });

  it("submits with form data", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithClient(<AddItemDialog open={true} onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText("e.g. Chicken Breast"), "Eggs");
    await user.type(screen.getByPlaceholderText("500"), "12");
    await user.type(screen.getByPlaceholderText("g"), "pcs");

    const submitBtn = screen.getByText("Add 1 Item");
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        items: [
          {
            ingredient_name: "Eggs",
            quantity: 12,
            unit: "pcs",
            expiry_date: null,
            category_hint: null,
            status: "available",
          },
        ],
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

  it("shows shopping title when defaultStatus is to_buy", () => {
    const onOpenChange = vi.fn();
    renderWithClient(
      <AddItemDialog open={true} onOpenChange={onOpenChange} defaultStatus="to_buy" />,
    );

    expect(screen.getByText("Add Shopping Items")).toBeInTheDocument();
  });

  it("hides expiry field when defaultStatus is to_buy", () => {
    renderWithClient(<AddItemDialog open={true} onOpenChange={vi.fn()} defaultStatus="to_buy" />);
    expect(screen.queryByText("Expiry")).not.toBeInTheDocument();
  });

  it("shows expiry field when defaultStatus is available", () => {
    renderWithClient(
      <AddItemDialog open={true} onOpenChange={vi.fn()} defaultStatus="available" />,
    );
    expect(screen.getByText("Expiry")).toBeInTheDocument();
  });

  it("adds and removes rows", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithClient(<AddItemDialog open={true} onOpenChange={onOpenChange} />);

    // Initially 1 row, no remove button
    const nameInputs = screen.getAllByPlaceholderText("e.g. Chicken Breast");
    expect(nameInputs).toHaveLength(1);

    // Add a row
    await user.click(screen.getByText("Add Row"));
    expect(screen.getAllByPlaceholderText("e.g. Chicken Breast")).toHaveLength(2);

    // Now remove buttons should appear (2 rows)
    const removeButtons = screen.getAllByRole("button").filter((btn) => {
      const svg = btn.querySelector("svg");
      return svg && btn.className.includes("shrink-0");
    });
    expect(removeButtons.length).toBeGreaterThanOrEqual(2);
  });
});
