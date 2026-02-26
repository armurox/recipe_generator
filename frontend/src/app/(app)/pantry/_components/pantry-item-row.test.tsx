import "@/test/mocks/next-mocks";
import { mockPantryItem } from "@/test/mocks/fixtures";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PantryItemRow } from "./pantry-item-row";

const defaultProps = {
  item: mockPantryItem,
  isSelectMode: false,
  isSelected: false,
  onToggleSelect: vi.fn(),
  onDelete: vi.fn(),
  onQuantityChange: vi.fn(),
  onEdit: vi.fn(),
};

describe("PantryItemRow", () => {
  it("renders ingredient name and quantity", () => {
    render(<PantryItemRow {...defaultProps} />);

    expect(screen.getByText("Chicken Breast")).toBeInTheDocument();
    expect(screen.getByText("500 g")).toBeInTheDocument();
  });

  it("shows delete button when not in select mode", () => {
    render(<PantryItemRow {...defaultProps} />);

    // Trash icon button exists
    const buttons = screen.getAllByRole("button");
    // Should have quantity button + delete button
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("hides delete button in select mode and shows checkbox", () => {
    render(<PantryItemRow {...defaultProps} isSelectMode={true} />);

    // Should show checkbox button
    const buttons = screen.getAllByRole("button");
    // In select mode: checkbox button + quantity button (no delete)
    expect(buttons).toHaveLength(2);
  });

  it("fires onDelete when trash is clicked", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<PantryItemRow {...defaultProps} onDelete={onDelete} />);

    // The last button should be the delete button (Trash2)
    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons[buttons.length - 1];
    await user.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledWith("pantry-item-1");
  });

  it("fires onToggleSelect when checkbox is clicked in select mode", async () => {
    const onToggleSelect = vi.fn();
    const user = userEvent.setup();
    render(<PantryItemRow {...defaultProps} isSelectMode={true} onToggleSelect={onToggleSelect} />);

    const buttons = screen.getAllByRole("button");
    // First button is the checkbox
    await user.click(buttons[0]);

    expect(onToggleSelect).toHaveBeenCalledWith("pantry-item-1");
  });

  it("fires onEdit when row is clicked", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<PantryItemRow {...defaultProps} onEdit={onEdit} />);

    // Click the row div (the ingredient name)
    await user.click(screen.getByText("Chicken Breast"));

    expect(onEdit).toHaveBeenCalledWith(mockPantryItem);
  });
});
