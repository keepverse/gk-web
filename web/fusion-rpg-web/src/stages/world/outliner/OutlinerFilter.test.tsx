import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutlinerFilter } from "./OutlinerFilter";

describe("OutlinerFilter — three exclusive chips, stated in words (world-stage W91)", () => {
  it("exactly one chip is checked, queried by aria-checked, not by fill alone", () => {
    render(<OutlinerFilter filter="needs-orders" onChange={() => {}} />);
    const checked = screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent("Needs orders");
  });

  it("clicking a chip reports the change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OutlinerFilter filter="all" onChange={onChange} />);
    await user.click(screen.getByTestId("outliner-filter-fading"));
    expect(onChange).toHaveBeenCalledWith("fading");
  });
});
