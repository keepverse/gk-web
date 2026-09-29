import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { dispatchGlobalVerb } from "@/shell/keymap";
import { Outliner } from "./Outliner";
import { buildOutlinerGroups } from "./outlinerModel";
import { EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS } from "./fixtures/empire28";

describe("The keyboard path, no pointer events at all (world-stage W93)", () => {
  it("O focuses the outliner", () => {
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    render(<Outliner groups={groups} selectedId={null} onSelect={() => {}} onCentreRequest={() => {}} />);

    expect(document.activeElement?.getAttribute("data-testid") ?? "").not.toMatch(/^outliner-row-/);
    expect(dispatchGlobalVerb("o")).toBe(true);
    expect(document.activeElement).toHaveAttribute("tabindex", "0");
  });

  it("arrows move focus while asserting selection did not change and the camera was not asked to move", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onCentreRequest = vi.fn();
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    render(<Outliner groups={groups} selectedId={null} onSelect={onSelect} onCentreRequest={onCentreRequest} />);

    dispatchGlobalVerb("o"); // focus the list the way a real session would before arrowing
    for (let i = 0; i < 4; i++) await user.keyboard("{ArrowDown}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(onCentreRequest).not.toHaveBeenCalled();
  });

  it("focusing four rows down leaves exactly one aria-selected — still on the original row", async () => {
    const user = userEvent.setup();
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    render(<Outliner groups={groups} selectedId="e-1" onSelect={() => {}} onCentreRequest={() => {}} />);

    dispatchGlobalVerb("o");
    for (let i = 0; i < 4; i++) await user.keyboard("{ArrowDown}");

    const selected = screen.getAllByRole("option").filter((el) => el.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAttribute("data-testid", "outliner-row-e-1");
  });

  it("⏎ selects the focused row and requests the camera centre on it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onCentreRequest = vi.fn();
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    render(<Outliner groups={groups} selectedId={null} onSelect={onSelect} onCentreRequest={onCentreRequest} />);

    dispatchGlobalVerb("o");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onCentreRequest).toHaveBeenCalledTimes(1);
    const [id, kind] = onSelect.mock.calls[0] as [string, string];
    const [centredRow] = onCentreRequest.mock.calls[0] as [{ id: string; kind: string }];
    expect(centredRow.id).toBe(id);
    expect(centredRow.kind).toBe(kind);
  });
});
