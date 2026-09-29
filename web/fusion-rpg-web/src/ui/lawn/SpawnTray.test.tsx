import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpawnTray } from "./SpawnTray";

const actor = {
  instanceId: "u1",
  playerId: 1,
  side: "plant" as const,
  typeId: 3,
  phase: "Roster",
  level: 1,
  xp: 0,
  revision: 0
};

describe("SpawnTray", () => {
  it("shows Bound rows locked with reason instead of filtering them out", () => {
    render(
      <SpawnTray
        open
        canSpawn
        entries={[
          { actor, lockedReason: "Already Bound on the lawn" },
          {
            actor: { ...actor, instanceId: "u2", typeId: 7 },
            lockedReason: undefined
          }
        ]}
        onPick={vi.fn()}
      />
    );
    expect(screen.getByTestId("spawn-tray-collection-item-u1")).toHaveAttribute(
      "title",
      "Already Bound on the lawn"
    );
    expect(screen.getByTestId("spawn-tray-collection-item-u1")).toHaveAttribute("data-chip", "Bound");
    expect(screen.getByTestId("spawn-tray-collection-item-u2")).not.toHaveAttribute("title");
  });

  it("does not pick a Bound row", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <SpawnTray
        open
        canSpawn
        entries={[{ actor, lockedReason: "Already Bound on the lawn" }]}
        onPick={onPick}
      />
    );
    await user.click(screen.getByTestId("spawn-tray-collection-item-u1"));
    expect(onPick).not.toHaveBeenCalled();
  });
});
