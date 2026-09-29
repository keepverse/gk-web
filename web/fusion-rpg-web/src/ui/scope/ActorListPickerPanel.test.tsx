import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { known, absent } from "@/contract/pending";
import type { ActorView } from "@/contract/types";
import type { ActorRungState } from "@/ui/actor";
import type { ScopeTargetCandidate } from "./ActorMenuScopePicker";
import { ActorListPickerPanel } from "./ActorListPickerPanel";

function readyActor(instanceId: string, name: string): ActorRungState {
  const data: ActorView = {
    instanceId,
    playerId: 1,
    side: "plant",
    typeId: 3,
    displayName: known(name),
    phase: "ActiveBound",
    level: 5,
    xp: 0,
    xpToNext: known(100),
    revision: 1,
    channelSummary: absent(),
    elementTyping: absent(),
    shieldStack: absent(),
    equipSlots: absent()
  };
  return { kind: "ready", data };
}

function targetReady(targetPtr: string, instanceId: string, name: string): ScopeTargetCandidate {
  return {
    kind: "ready",
    targetPtr,
    rungState: readyActor(instanceId, name) as Extract<ActorRungState, { kind: "ready" }>
  };
}

describe("ActorListPickerPanel", () => {
  it("renders candidates through the real ActorRow, not a lookalike", () => {
    render(
      <ActorListPickerPanel
        kind="target"
        targetCandidates={[targetReady("P:3:1,2", "a1", "Emberling")]}
        value={null}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("actor-row")).toBeInTheDocument();
    expect(screen.getByTestId("actor-name")).toHaveTextContent("Emberling");
  });

  it("emits targetPtr from the explicit candidate field — never instanceId", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ActorListPickerPanel
        kind="target"
        targetCandidates={[targetReady("P:3:1,2", "a1", "Emberling")]}
        value={null}
        onChange={onChange}
      />
    );
    await user.click(screen.getByTestId("scope-target-collection-item-P:3:1,2"));
    expect(onChange).toHaveBeenCalledWith({ kind: "target", targetPtr: "P:3:1,2" });
  });

  it("skips ready target candidates that lack a targetPtr", () => {
    render(
      <ActorListPickerPanel
        kind="target"
        targetCandidates={[
          {
            kind: "ready",
            targetPtr: "   ",
            rungState: readyActor("a1", "Emberling") as Extract<ActorRungState, { kind: "ready" }>
          }
        ]}
        value={null}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("scope-target-empty")).toBeInTheDocument();
  });

  it("emits a uniqueCreature-kind value with the candidate's instanceId", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ActorListPickerPanel
        kind="uniqueCreature"
        candidates={[readyActor("d1", "Ashkell")]}
        value={null}
        onChange={onChange}
      />
    );
    await user.click(screen.getByTestId("scope-uniqueCreature-collection-item-d1"));
    expect(onChange).toHaveBeenCalledWith({ kind: "uniqueCreature", instanceId: "d1" });
  });

  it("marks the currently selected candidate as selected", () => {
    render(
      <ActorListPickerPanel
        kind="target"
        targetCandidates={[targetReady("P:3:1,2", "a1", "Emberling")]}
        value={{ kind: "target", targetPtr: "P:3:1,2" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("scope-target-collection-item-P:3:1,2")).toHaveAttribute(
      "data-selected",
      "true"
    );
  });

  it("renders a clear empty state with no candidates", () => {
    render(<ActorListPickerPanel kind="target" targetCandidates={[]} value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("scope-target-empty")).toBeInTheDocument();
  });

  it("renders non-ready states (loading/error) via ActorRow's own fallback, not selectable", () => {
    const targetCandidates: ScopeTargetCandidate[] = [
      { kind: "loading" },
      { kind: "error", message: "boom" }
    ];
    render(
      <ActorListPickerPanel kind="target" targetCandidates={targetCandidates} value={null} onChange={vi.fn()} />
    );
    expect(screen.getByTestId("actor-row-loading")).toBeInTheDocument();
    expect(screen.getByTestId("actor-row-error")).toBeInTheDocument();
    expect(screen.getByTestId("scope-target-collection-item-pending-target-0")).toBeDisabled();
    expect(screen.getByTestId("scope-target-collection-item-pending-target-1")).toBeDisabled();
  });
});
