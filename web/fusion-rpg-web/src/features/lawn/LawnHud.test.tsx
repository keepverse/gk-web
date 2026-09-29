import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LawnHud } from "./LawnHud";

describe("LawnHud (T28)", () => {
  it("renders real sun and wave numbers, not placeholders, when the economy snapshot is present", () => {
    render(<LawnHud sun={1240} wave={7} maxWave={14} hugeWave={false} deployed={[]} />);
    expect(screen.getByTestId("lawn-hud-sun")).toHaveTextContent("1240");
    expect(screen.getByTestId("lawn-hud-wave")).toHaveTextContent("Wave 7 of 14");
    expect(screen.getByTestId("lawn-hud-wave")).not.toHaveTextContent("huge");
  });

  it("flags a huge wave", () => {
    render(<LawnHud sun={0} wave={10} maxWave={10} hugeWave deployed={[]} />);
    expect(screen.getByTestId("lawn-hud-wave")).toHaveTextContent("huge");
  });

  it("shows an honest placeholder when the economy snapshot hasn't arrived yet, not a fabricated zero", () => {
    render(<LawnHud deployed={[]} />);
    expect(screen.getByTestId("lawn-hud-sun")).toHaveTextContent("—");
    expect(screen.getByTestId("lawn-hud-wave")).toHaveTextContent("Wave —");
  });

  it("renders one chip per deployed creature, and an honest empty state with none", () => {
    const { rerender } = render(<LawnHud deployed={[]} />);
    expect(screen.getByTestId("lawn-hud-deployed-empty")).toBeInTheDocument();

    rerender(
      <LawnHud
        deployed={[
          { ptr: "p1", side: "plant", typeId: 3, typeName: "Emberling" },
          { ptr: "p2", side: "plant", typeId: 4, typeName: null }
        ]}
      />
    );
    expect(screen.queryByTestId("lawn-hud-deployed-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("lawn-hud-deployed-p1")).toHaveTextContent("Emberling");
    expect(screen.getByTestId("lawn-hud-deployed-p2")).toHaveTextContent("#4"); // honest fallback, no fabricated name
  });

  it("the playback cluster is disabled and states why — no speed/pause control exists in this app", () => {
    render(<LawnHud deployed={[]} />);
    const playback = screen.getByTestId("lawn-hud-playback");
    expect(playback).toHaveAttribute("title", expect.stringContaining("No playback control"));
    for (const label of ["Pause", "Normal speed", "Double speed"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
  });

  it("renders commander and aura chips from the match snapshot fold", () => {
    render(
      <LawnHud
        matchCommander={{ id: "commander:dave", displayName: "Crazy Dave", auraDisplayName: "Might" }}
        deployed={[]}
      />
    );
    expect(screen.getByTestId("lawn-hud-commander")).toHaveTextContent("Crazy Dave");
    expect(screen.getByTestId("lawn-hud-aura")).toHaveTextContent("Might");
  });

  it("hides the aura chip when the snapshot has no active aura name", () => {
    render(
      <LawnHud matchCommander={{ id: "commander:dave", displayName: "Crazy Dave", auraDisplayName: null }} deployed={[]} />
    );
    expect(screen.getByTestId("lawn-hud-commander")).toBeInTheDocument();
    expect(screen.queryByTestId("lawn-hud-aura")).not.toBeInTheDocument();
  });

  it("tap on the commander chip calls onOpenCommanderSheet", async () => {
    const user = userEvent.setup();
    const onOpenCommanderSheet = vi.fn();
    render(
      <LawnHud
        matchCommander={{ id: "commander:dave", displayName: "Crazy Dave", auraDisplayName: "Might" }}
        deployed={[]}
        onOpenCommanderSheet={onOpenCommanderSheet}
      />
    );
    await user.click(screen.getByTestId("lawn-hud-commander-open"));
    expect(onOpenCommanderSheet).toHaveBeenCalledTimes(1);
  });
});
