import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lanePath } from "../stageIds";
import { LegionMarker } from "./LegionMarker";
import { ForceChip, forceLabel, type ForceChipView } from "./ForceChip";

/**
 * jsdom has no SVG geometry, so the lane path is stubbed: 1000 units long, laid out along x. That is
 * enough to prove the two things that matter — the marker walks the lane, and it does so without the
 * React tree re-rendering once.
 */
function stubLanePath(id: string) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = id;
  Object.assign(path, {
    getTotalLength: () => 1000,
    getPointAtLength: (len: number) => ({ x: len, y: 0 })
  });
  document.body.appendChild(path);
  return path;
}

let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/** Runs whatever frames are pending; each may schedule the next. */
function pump(times: number) {
  for (let i = 0; i < times; i++) {
    const pending = frames;
    frames = [];
    act(() => pending.forEach((cb) => cb(0)));
  }
}

describe("LegionMarker", () => {
  it("finds the lane path by stageIds.lanePath(laneId) — the replacement contract for the id React Flow used to supply", () => {
    stubLanePath(lanePath("l-home-ember"));
    let clock = 0;

    render(
      <svg>
        <LegionMarker
          pathId={lanePath("l-home-ember")}
          entityId="e-dave-legion-1"
          fromMilli={0}
          toMilli={1000}
          durationMs={100}
          ownership="yours"
          now={() => clock}
        />
      </svg>
    );

    expect(screen.getByTestId("legion-marker-e-dave-legion-1")).toHaveAttribute("transform", "translate(0, 0)");
  });

  it("starts where the force was and ends where it stopped", () => {
    stubLanePath(lanePath("l-home-ember"));
    let clock = 0;

    render(
      <svg>
        <LegionMarker
          pathId={lanePath("l-home-ember")}
          entityId="e-dave-legion-1"
          fromMilli={200}
          toMilli={800}
          durationMs={100}
          ownership="yours"
          now={() => clock}
        />
      </svg>
    );

    const marker = screen.getByTestId("legion-marker-e-dave-legion-1");
    expect(marker).toHaveAttribute("transform", "translate(200, 0)");

    clock = 50;
    pump(1);
    expect(marker).toHaveAttribute("transform", "translate(500, 0)");

    clock = 100;
    pump(1);
    expect(marker).toHaveAttribute("transform", "translate(800, 0)");
  });

  it("stops scheduling frames once it has arrived", () => {
    stubLanePath(lanePath("l-home-ember"));
    let clock = 0;

    render(
      <svg>
        <LegionMarker
          pathId={lanePath("l-home-ember")}
          entityId="e-a"
          fromMilli={0}
          toMilli={1000}
          durationMs={100}
          ownership="yours"
          now={() => clock}
        />
      </svg>
    );

    clock = 500;
    pump(1);
    expect(frames).toHaveLength(0);
  });

  /** The whole point of the ref-and-rAF approach. */
  it("never re-renders React while it animates", () => {
    stubLanePath(lanePath("l-home-ember"));
    const renders = vi.fn();
    let clock = 0;

    function Counting() {
      renders();
      return (
        <svg>
          <LegionMarker
            pathId={lanePath("l-home-ember")}
            entityId="e-a"
            fromMilli={0}
            toMilli={1000}
            durationMs={1000}
            ownership="yours"
            now={() => clock}
          />
        </svg>
      );
    }

    render(<Counting />);
    expect(renders).toHaveBeenCalledTimes(1);

    for (let i = 1; i <= 8; i++) {
      clock = i * 100;
      pump(1);
    }

    expect(screen.getByTestId("legion-marker-e-a")).toHaveAttribute("transform", "translate(800, 0)");
    expect(renders).toHaveBeenCalledTimes(1);
  });

  /**
   * A marker that is re-rendered for an unrelated reason — a force changing sides, say — must carry
   * on from where it is. Restarting the march every time the component happens to render would make
   * a legion stutter back to the start of the lane for no reason a player could see.
   */
  it("carries on across a re-render instead of snapping back to the start", () => {
    stubLanePath(lanePath("l-home-ember"));
    let clock = 0;

    const marker = (ownership: "yours" | "enemy") => (
      <svg>
        <LegionMarker
          pathId={lanePath("l-home-ember")}
          entityId="e-a"
          fromMilli={0}
          toMilli={1000}
          durationMs={1000}
          ownership={ownership}
          now={() => clock}
        />
      </svg>
    );

    const { rerender } = render(marker("yours"));

    clock = 500;
    pump(1);
    expect(screen.getByTestId("legion-marker-e-a")).toHaveAttribute("transform", "translate(500, 0)");

    // Same march, different ownership (a force changing sides). Nothing about where it is has changed.
    rerender(marker("enemy"));

    expect(screen.getByTestId("legion-marker-e-a")).toHaveAttribute("transform", "translate(500, 0)");
  });

  it("does nothing at all when the lane it was told about is not on screen", () => {
    render(
      <svg>
        <LegionMarker
          pathId={lanePath("missing-lane")}
          entityId="e-a"
          fromMilli={0}
          toMilli={1000}
          durationMs={100}
          ownership="yours"
        />
      </svg>
    );

    expect(screen.getByTestId("legion-marker-e-a")).not.toHaveAttribute("transform");
    expect(frames).toHaveLength(0);
  });

  it("ownership reads as three different shapes, never sharing one between yours/enemy/contested", () => {
    stubLanePath(lanePath("l-home-ember"));
    const shapesRendered = new Set<string>();

    for (const ownership of ["yours", "enemy", "contested"] as const) {
      const { unmount } = render(
        <svg>
          <LegionMarker
            pathId={lanePath("l-home-ember")}
            entityId={`e-${ownership}`}
            fromMilli={0}
            toMilli={0}
            durationMs={0}
            ownership={ownership}
          />
        </svg>
      );
      const marker = screen.getByTestId(`legion-marker-e-${ownership}`);
      const glyph = marker.firstElementChild;
      // A shape signature that actually distinguishes triangle from diamond — both render as a
      // <polygon>, so the tag name alone is not enough; the point coordinates are the real shape.
      shapesRendered.add(`${glyph?.tagName.toLowerCase()}:${glyph?.getAttribute("points") ?? ""}`);
      unmount();
    }

    expect(shapesRendered.size).toBe(3);
  });
});

describe("ForceChip — strength that cannot lie (world-stage W46)", () => {
  it("an exact force prints its counted strength", () => {
    const view: ForceChipView = { entityId: "e-1", ownership: "yours", routed: false, exact: true, strength: 42 };
    expect(forceLabel(view)).toBe("42");
  });

  it("a banded force prints its band name and ceiling — never a bare Strength 0", () => {
    const view: ForceChipView = {
      entityId: "e-2",
      ownership: "enemy",
      routed: false,
      exact: false,
      bandName: "A host",
      bandCeiling: 2400
    };
    expect(forceLabel(view)).toBe("A host — plan for 2,400");
    expect(forceLabel(view)).not.toMatch(/\b0\b/);
  });

  it("renders with data attributes proving ownership, exactness and routed state", () => {
    const view: ForceChipView = { entityId: "e-3", ownership: "enemy", routed: true, exact: true, strength: 12 };
    render(<ForceChip {...view} />);

    const chip = screen.getByTestId("force-chip-e-3");
    expect(chip).toHaveAttribute("data-ownership", "enemy");
    expect(chip).toHaveAttribute("data-routed", "true");
    expect(chip).toHaveAttribute("data-exact", "true");
  });
});
