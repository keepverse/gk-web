import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outliner } from "./Outliner";
import { buildOutlinerGroups } from "./outlinerModel";
import { EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS } from "./fixtures/empire28";

function tabbableRows() {
  return screen.getAllByRole("option").filter((el) => el.getAttribute("tabindex") === "0");
}

describe("Outliner — the real listbox, one roving tab stop (world-stage W91)", () => {
  it("is a real listbox: role, options, group headings carrying their count", () => {
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    render(<Outliner groups={groups} selectedId={null} onSelect={() => {}} onCentreRequest={() => {}} />);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(28);
    expect(screen.getByTestId("outliner-group-legion")).toHaveTextContent("Legions (10)");
    expect(screen.getByTestId("outliner-group-sector")).toHaveTextContent("Sectors (18)");
  });

  it("exactly one row has tabIndex 0 at all times", () => {
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    render(<Outliner groups={groups} selectedId={null} onSelect={() => {}} onCentreRequest={() => {}} />);
    expect(tabbableRows()).toHaveLength(1);
  });

  it("clicking a row selects it and moves the roving tab stop to it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    render(<Outliner groups={groups} selectedId={null} onSelect={onSelect} onCentreRequest={() => {}} />);

    await user.click(screen.getByTestId("outliner-row-e-3"));
    expect(onSelect).toHaveBeenCalledWith("e-3", "legion");
    expect(screen.getByTestId("outliner-row-e-3")).toHaveAttribute("tabindex", "0");
    expect(tabbableRows()).toHaveLength(1);
  });

  it("still exactly one tabbable row after a filter removes the active one — it falls forward, never to zero", () => {
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    const { rerender } = render(<Outliner groups={groups} selectedId={null} onSelect={() => {}} onCentreRequest={() => {}} />);

    const firstRowId = screen.getAllByRole("option")[0]!.getAttribute("data-testid")!.replace("outliner-row-", "");

    // A filter that drops the currently-active row entirely.
    const filtered = groups.map((g) => ({ ...g, rows: g.rows.filter((r) => r.id !== firstRowId), count: g.rows.length }));
    rerender(<Outliner groups={filtered} selectedId={null} onSelect={() => {}} onCentreRequest={() => {}} />);

    expect(screen.queryByTestId(`outliner-row-${firstRowId}`)).not.toBeInTheDocument();
    expect(tabbableRows()).toHaveLength(1);
  });

  it("no interactive row is missing its role or tabIndex — every option is a real one", () => {
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    render(<Outliner groups={groups} selectedId={null} onSelect={() => {}} onCentreRequest={() => {}} />);
    for (const row of screen.getAllByRole("option")) {
      expect(row).toHaveAttribute("tabindex");
    }
  });
});
