import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { adaptActor, PLAYER_PENDING } from "@/contract/adapt";
import type { UniqueActorDto } from "@/lib/bus/types";
import { renderWithProviders } from "@/test/render";
import { ActorCard, ActorChip, ActorPanel, ActorRow, ActorToken, type ActorRungState } from "./index";

const baseDto: UniqueActorDto = {
  instanceId: "a1b2c3d4e5f6",
  playerId: 1,
  side: "plant",
  typeId: 3,
  phase: "ActiveBound",
  level: 14,
  xp: 900,
  revision: 2
};

const ready: ActorRungState = { kind: "ready", data: adaptActor(baseDto) };
const loading: ActorRungState = { kind: "loading" };
const empty: ActorRungState = { kind: "empty" };
const error: ActorRungState = { kind: "error", message: "network error" };
const locked: ActorRungState = { kind: "locked", reason: "Unlocks at Sanctum level 5" };

const RUNGS = [
  // ActorToken shows only a single-glyph initial by design (the smallest rung); it's checked
  // separately below, not against the "full name renders" assertion the other rungs share.
  { name: "ActorChip", Component: ActorChip, testId: "actor-chip" },
  { name: "ActorRow", Component: ActorRow, testId: "actor-row" },
  { name: "ActorCard", Component: ActorCard, testId: "actor-card" }
] as const;

describe.each(RUNGS)("$name — four states", ({ Component, testId, name }) => {
  it("ready renders real data from the shared ActorView contract", () => {
    render(<Component state={ready} />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it("loading renders the shared loading fallback", () => {
    render(<Component state={loading} />);
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("empty renders the shared empty fallback", () => {
    render(<Component state={empty} />);
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
  });

  it("error renders the shared error fallback carrying the message", () => {
    render(<Component state={error} />);
    const el = document.querySelector("[title]");
    expect(el?.getAttribute("title")).toBe("network error");
  });

  it("locked renders the shared locked fallback carrying the reason", () => {
    render(<Component state={locked} />);
    const el = document.querySelector("[title]");
    expect(el?.getAttribute("title")).toBe("Unlocks at Sanctum level 5");
  });

  it(`${name}: a CJK name renders without breaking the rung`, () => {
    const cjkState: ActorRungState = {
      kind: "ready",
      data: { ...ready.data, displayName: { state: "known", value: "凋零指挥官阿什凯尔" } }
    };
    render(<Component state={cjkState} />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.getByText("凋零指挥官阿什凯尔")).toBeInTheDocument();
  });
});

describe("ActorToken — four states", () => {
  it("ready renders the framed initial", () => {
    render(<ActorToken state={ready} />);
    expect(screen.getByTestId("actor-token")).toBeInTheDocument();
  });

  it("loading renders the shared loading fallback", () => {
    render(<ActorToken state={loading} />);
    expect(screen.queryByTestId("actor-token")).not.toBeInTheDocument();
  });

  it("empty renders the shared empty fallback", () => {
    render(<ActorToken state={empty} />);
    expect(screen.queryByTestId("actor-token")).not.toBeInTheDocument();
  });

  it("error carries the message", () => {
    render(<ActorToken state={error} />);
    expect(document.querySelector("[title]")?.getAttribute("title")).toBe("network error");
  });

  it("locked carries the reason", () => {
    render(<ActorToken state={locked} />);
    expect(document.querySelector("[title]")?.getAttribute("title")).toBe("Unlocks at Sanctum level 5");
  });

  it("a CJK name renders its first glyph as the initial without breaking the rung", () => {
    const cjkState: ActorRungState = {
      kind: "ready",
      data: { ...ready.data, displayName: { state: "known", value: "凋零指挥官阿什凯尔" } }
    };
    render(<ActorToken state={cjkState} />);
    expect(screen.getByTestId("actor-token")).toHaveTextContent("凋");
  });
});

function PanelHarness({ state }: { state: ActorRungState }) {
  const [open, setOpen] = useState(true);
  return <ActorPanel state={state} open={open} onOpenChange={setOpen} />;
}

describe("ActorPanel — four states", () => {
  it("ready renders real data and the deploy/release actions", () => {
    renderWithProviders(<PanelHarness state={ready} />, { withGlobalKeys: true });
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
    expect(screen.getByTestId("actor-panel-deploy")).toBeInTheDocument();
    expect(screen.getByTestId("actor-panel-release")).toBeInTheDocument();
  });

  it("loading renders the shared loading fallback inside the shell", () => {
    renderWithProviders(<PanelHarness state={loading} />, { withGlobalKeys: true });
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("locked renders the reason", () => {
    renderWithProviders(<PanelHarness state={locked} />, { withGlobalKeys: true });
    const el = document.querySelector("[title]");
    expect(el?.getAttribute("title")).toBe("Unlocks at Sanctum level 5");
  });

  it("a CJK name renders in the panel title without breaking the shell", () => {
    const cjkState: ActorRungState = {
      kind: "ready",
      data: { ...ready.data, displayName: { state: "known", value: "凋零指挥官阿什凯尔" } }
    };
    renderWithProviders(<PanelHarness state={cjkState} />, { withGlobalKeys: true });
    expect(screen.getByRole("heading", { name: "凋零指挥官阿什凯尔" })).toBeInTheDocument();
  });

  it("Esc closes it, same as every other band-2 panel", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PanelHarness state={ready} />, { withGlobalKeys: true });
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("actor-panel")).not.toBeInTheDocument());
  });
});

describe("one contract type, no forked components (T8)", () => {
  it("all five rungs render the same underlying ActorView without re-deriving its shape", () => {
    const data = adaptActor(baseDto);
    const state: ActorRungState = { kind: "ready", data };

    render(
      <div>
        <ActorToken state={state} />
        <ActorChip state={state} />
        <ActorRow state={state} />
        <ActorCard state={state} />
      </div>
    );

    // Every rung that shows the level renders the exact same number from the exact same field.
    const levelTags = screen.getAllByTestId("actor-level");
    expect(levelTags.length).toBeGreaterThanOrEqual(3);
    levelTags.forEach((tag) => expect(tag).toHaveTextContent(`Lv ${data.level}`));
  });

  it("not-yet-servable fields render their pending reason honestly instead of fake numbers", () => {
    const data = adaptActor(baseDto);
    render(<ActorCard state={{ kind: "ready", data }} />);
    expect(screen.getByTestId("actor-standing-pending")).toHaveTextContent(PLAYER_PENDING.channelSummary);
  });
});
