import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PanelShell } from "@/shell/PanelShell";
import { ANCHORS, ANCHOR_OWNER } from "./anchors";
import { WorldHud } from "./WorldHud";

describe("WorldHud — the band-1 frame (world-stage W51)", () => {
  it("every reserved anchor exists even when nothing occupies it — reserved, not omitted", () => {
    render(<WorldHud>map</WorldHud>);

    expect(screen.getByTestId("world-hud-anchor-top-strip")).toBeInTheDocument();
    expect(screen.getByTestId("world-hud-anchor-right-edge")).toBeInTheDocument();
    expect(screen.getByTestId("world-hud-anchor-bottom-right")).toBeInTheDocument();
    expect(screen.getByTestId("world-hud-anchor-bottom-left")).toBeInTheDocument();
  });

  it("left-edge is the one conditional occupant — absent when nothing selects it", () => {
    render(<WorldHud>map</WorldHud>);
    expect(screen.queryByTestId("world-hud-anchor-left-edge")).not.toBeInTheDocument();
  });

  it("left-edge appears once something is passed to occupy it", () => {
    render(<WorldHud leftEdge={<span>inspector</span>}>map</WorldHud>);
    expect(screen.getByTestId("world-hud-anchor-left-edge")).toHaveTextContent("inspector");
  });

  it("each anchor renders its own occupant, in its own container, never leaking into another", () => {
    render(
      <WorldHud
        topStrip={<span>top</span>}
        rightEdge={<span>right</span>}
        bottomRight={<span>br</span>}
        bottomLeft={<span>bl</span>}
        leftEdge={<span>left</span>}
      >
        map
      </WorldHud>
    );

    expect(screen.getByTestId("world-hud-anchor-top-strip")).toHaveTextContent("top");
    expect(screen.getByTestId("world-hud-anchor-right-edge")).toHaveTextContent("right");
    expect(screen.getByTestId("world-hud-anchor-bottom-right")).toHaveTextContent("br");
    expect(screen.getByTestId("world-hud-anchor-bottom-left")).toHaveTextContent("bl");
    expect(screen.getByTestId("world-hud-anchor-left-edge")).toHaveTextContent("left");

    // No cross-contamination: each anchor carries only its own occupant's text.
    expect(screen.getByTestId("world-hud-anchor-top-strip")).not.toHaveTextContent("right");
    expect(screen.getByTestId("world-hud-anchor-bottom-right")).not.toHaveTextContent("bl");
  });

  it("the map fills its own layer, independent of the anchors around it", () => {
    render(<WorldHud>{"the map itself"}</WorldHud>);
    expect(screen.getByTestId("world-hud-map-layer")).toHaveTextContent("the map itself");
  });

  it("the band never grows the page — the frame itself is overflow-hidden, not overflow-auto", () => {
    render(<WorldHud>map</WorldHud>);
    expect(screen.getByTestId("world-hud")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("world-hud").className).not.toMatch(/overflow-auto/);
  });

  it("every anchor still permits its own body to scroll — bounded, not frozen solid", () => {
    render(
      <WorldHud rightEdge={<span>right</span>} leftEdge={<span>left</span>}>
        map
      </WorldHud>
    );
    // right-edge/left-edge (notify/outliner, the inspector) are the anchors expected to carry a
    // scrolling feed of their own — bounded position, scrollable body, never a page scroll.
    expect(screen.getByTestId("world-hud-anchor-right-edge")).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("world-hud-anchor-left-edge")).toHaveClass("overflow-y-auto");
  });

  it("every anchor is Band 1 (HUD) — found missing at W51, added here for the GG-5 amendment", () => {
    render(
      <WorldHud
        topStrip={<span>top</span>}
        rightEdge={<span>right</span>}
        bottomRight={<span>br</span>}
        bottomLeft={<span>bl</span>}
        leftEdge={<span>left</span>}
      >
        map
      </WorldHud>
    );
    expect(screen.getByTestId("world-hud-anchor-top-strip")).toHaveClass("band-hud");
    expect(screen.getByTestId("world-hud-anchor-right-edge")).toHaveClass("band-hud");
    expect(screen.getByTestId("world-hud-anchor-bottom-right")).toHaveClass("band-hud");
    expect(screen.getByTestId("world-hud-anchor-bottom-left")).toHaveClass("band-hud");
    expect(screen.getByTestId("world-hud-anchor-left-edge")).toHaveClass("band-hud");
  });
});

/**
 * world-stage W55 — the GG-5 amendment mounts the HUD and a real band-2 (Panel) layer together.
 * jsdom never loads the actual Tailwind stylesheet, so `getComputedStyle` cannot resolve a class to
 * a real z-index in this environment — the same limitation `Toasts.test.tsx`'s "is band-toast,
 * never a bespoke z-index" already works around, by asserting the *class* each element carries
 * rather than a live-computed value. Combined with `shells.test.tsx`'s direct read of the real
 * generated `theme/tokens.css` (proving `band-scrim` sits strictly between `band-stage` and
 * `band-hud` numerically), the two tests together are this repo's standing technique for proving a
 * GG-5 stacking claim without a real browser.
 */
function HudOverPanelHarness() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <WorldHud topStrip={<span data-testid="hud-text">Income 1,200</span>}>map</WorldHud>
      <PanelShell open={open} onOpenChange={setOpen} title="Roster" testId="panel-under-test">
        Body
      </PanelShell>
    </div>
  );
}

describe("WorldHud + PanelShell together — the HUD outranks the scrim (world-stage W55)", () => {
  it("with a band-2 layer open, the HUD's own anchor still carries band-hud and the scrim carries band-scrim, never band-panel", () => {
    render(<HudOverPanelHarness />);

    expect(screen.getByTestId("hud-text")).toBeInTheDocument();
    expect(screen.getByTestId("world-hud-anchor-top-strip")).toHaveClass("band-hud");

    const scrim = screen.getByTestId("panel-under-test-overlay");
    expect(scrim.className).toContain("band-scrim");
    expect(scrim.className).not.toContain("band-panel");
  });
});

describe("anchors.ts — the corner-role registry", () => {
  it("names exactly five anchors, and the top-left rail is not one of them", () => {
    expect(ANCHORS).toEqual(["top-strip", "right-edge", "bottom-right", "bottom-left", "left-edge"]);
    expect(Object.keys(ANCHOR_OWNER)).toHaveLength(5);
  });

  it("only left-edge is documented as the conditional occupant", () => {
    const conditional = Object.entries(ANCHOR_OWNER).filter(([, owner]) => owner.includes("conditional"));
    expect(conditional).toHaveLength(1);
    expect(conditional[0]?.[0]).toBe("left-edge");
  });
});
