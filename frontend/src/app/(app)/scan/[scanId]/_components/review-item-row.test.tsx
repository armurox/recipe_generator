import "@/test/mocks/next-mocks";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { ReviewItemRow } from "./review-item-row";

function renderWithForm(ingredientName: string | null, defaultName: string = "Chicken") {
  const onRemove = vi.fn();
  const defaultValues = {
    items: [
      {
        receipt_item_id: 1,
        ingredient_name: defaultName,
        quantity: "2",
        unit: "pcs",
      },
    ],
  };

  function TestComponent() {
    const form = useForm({ defaultValues });
    return (
      <ReviewItemRow
        index={0}
        ingredientName={ingredientName}
        register={form.register}
        onRemove={onRemove}
      />
    );
  }

  render(<TestComponent />);
  return { onRemove };
}

describe("ReviewItemRow", () => {
  it("renders name, quantity, and unit inputs", () => {
    renderWithForm("Chicken");

    // Name input with the default value
    const nameInput = screen.getByDisplayValue("Chicken");
    expect(nameInput).toBeInTheDocument();

    // Quantity input
    const qtyInput = screen.getByDisplayValue("2");
    expect(qtyInput).toBeInTheDocument();

    // Unit select
    const unitSelect = screen.getByDisplayValue("pcs");
    expect(unitSelect).toBeInTheDocument();
  });

  it("shows green confidence dot for normal names", () => {
    const { container } = render(
      (() => {
        function TestComponent() {
          const form = useForm({
            defaultValues: {
              items: [
                { receipt_item_id: 1, ingredient_name: "Chicken", quantity: "2", unit: "pcs" },
              ],
            },
          });
          return (
            <ReviewItemRow
              index={0}
              ingredientName="Chicken Breast"
              register={form.register}
              onRemove={() => {}}
            />
          );
        }
        return <TestComponent />;
      })(),
    );

    const dot = container.querySelector(".bg-green-500");
    expect(dot).toBeInTheDocument();
  });

  it("shows yellow confidence dot for short/all-caps names", () => {
    const { container } = render(
      (() => {
        function TestComponent() {
          const form = useForm({
            defaultValues: {
              items: [{ receipt_item_id: 1, ingredient_name: "MILK", quantity: "1", unit: "pcs" }],
            },
          });
          return (
            <ReviewItemRow
              index={0}
              ingredientName="MILK"
              register={form.register}
              onRemove={() => {}}
            />
          );
        }
        return <TestComponent />;
      })(),
    );

    const dot = container.querySelector(".bg-yellow-500");
    expect(dot).toBeInTheDocument();
  });

  it("shows red confidence dot for null names", () => {
    const { container } = render(
      (() => {
        function TestComponent() {
          const form = useForm({
            defaultValues: {
              items: [{ receipt_item_id: 1, ingredient_name: "", quantity: "1", unit: "pcs" }],
            },
          });
          return (
            <ReviewItemRow
              index={0}
              ingredientName={null}
              register={form.register}
              onRemove={() => {}}
            />
          );
        }
        return <TestComponent />;
      })(),
    );

    const dot = container.querySelector(".bg-red-500");
    expect(dot).toBeInTheDocument();
  });

  it("fires onRemove when X button is clicked", async () => {
    const user = userEvent.setup();
    const { onRemove } = renderWithForm("Chicken");

    const removeBtn = screen.getByRole("button");
    await user.click(removeBtn);

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
