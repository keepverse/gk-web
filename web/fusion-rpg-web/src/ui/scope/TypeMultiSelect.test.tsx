import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TypeMultiSelect } from "./TypeMultiSelect";

const OPTIONS = [
  { typeId: 3, label: "Sunflower" },
  { typeId: 7, label: "Peashooter" }
];

describe("TypeMultiSelect", () => {
  it("checking an option adds its typeId to the selection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TypeMultiSelect options={OPTIONS} value={[]} onChange={onChange} />);
    await user.click(screen.getByTestId("scope-type-option-3"));
    expect(onChange).toHaveBeenCalledWith([3]);
  });

  it("unchecking an already-selected option removes just that typeId", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TypeMultiSelect options={OPTIONS} value={[3, 7]} onChange={onChange} />);
    await user.click(screen.getByTestId("scope-type-option-3"));
    expect(onChange).toHaveBeenCalledWith([7]);
  });

  it("reflects the current value's checked state", () => {
    render(<TypeMultiSelect options={OPTIONS} value={[7]} onChange={vi.fn()} />);
    expect(screen.getByTestId("scope-type-option-3")).not.toBeChecked();
    expect(screen.getByTestId("scope-type-option-7")).toBeChecked();
  });

  it("renders a clear empty state with no options", () => {
    render(<TypeMultiSelect options={[]} value={[]} onChange={vi.fn()} />);
    expect(screen.getByTestId("scope-type-empty")).toBeInTheDocument();
  });
});
