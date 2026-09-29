import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { renderWithProviders } from "@/test/render";
import { getStageMountCount, resetStageMountCounts } from "@/shell/stageHost";
import { handleEscape, resetKeymapForTests } from "@/shell/keymap";
import { useLayerStack } from "@/shell/layerStack";
import { DELVE_PANEL_IDS } from "./layers/panelId";
import { DelveStage } from "./DelveStage";

/** The real content test id each of the six D5.7 panels renders — `DelvePanelHost.tsx`'s own switch. */
const PANEL_CONTENT_TESTID: Record<(typeof DELVE_PANEL_IDS)[number], string> = {
  pack: "delve-panel-pack",
  talk: "delve-panel-talk",
  event: "delve-panel-event",
  object: "delve-panel-object",
  supply: "delve-panel-supply",
  fight: "delve-panel-fight"
};

/** Renders the current route's own search string so a test can assert the URL itself returns to bare
 * (`?panel=` gone), not just that the panel's DOM node unmounted — `MemoryRouter` gives no
 * `window.location` to read directly. */
function LocationSearchProbe() {
  const location = useLocation();
  return <span data-testid="test-location-search">{location.search}</span>;
}

/** A route-local harness that can open/close the `?panel=` search param the same way a real
 * panel-opening verb will (D5.7+, unbuilt) — `useSearchParams` here and `DelveStage`'s own internal
 * call both read/write the SAME router location, so this never needs `window.history`/`popstate`
 * (which `MemoryRouter` does not listen to at all) to drive the URL contract under test. */
function DelveStageHarness() {
  const [, setSearchParams] = useSearchParams();
  return (
    <>
      <button
        type="button"
        data-testid="test-open-pack-panel"
        onClick={() => setSearchParams({ panel: "pack" })}
      >
        open pack panel
      </button>
      <DelveStage />
    </>
  );
}

describe("DelveStage — shell wiring (D5.1) plus the real room graph (D5.4)", () => {
  beforeEach(() => {
    resetStageMountCounts();
    resetKeymapForTests();
    // Unlike SiegeStage, DelveStage claims the escape stack itself (claimStageEscape) — reset the
    // shared zustand store too, mirroring WorldStage.test.tsx's own identical beforeEach, so a
    // leftover entry from one test can never corrupt the next.
    useLayerStack.setState({ layers: [] });
  });

  it("mounts exactly once and renders the real room graph, fixture-fed, with no panel open", () => {
    // "/delve/abc" — a non-numeric id, same route D5.1's own tests used — leaves useDelve's query
    // disabled (DelveStage.tsx: `Number.isFinite(NaN)` is false), so the stage falls back to the
    // bundled first-descent.json fixture rather than an empty graph. This is the honest, only way to
    // exercise the graph today — DelveEndpoints.cs's own HandleStart doc comment records that a real,
    // playable delve cannot be created through the normal flow yet (dungeon_domain is empty).
    renderWithProviders(<DelveStage />, { route: "/delve/abc" });

    expect(screen.getByTestId("delve-stage-frame")).toBeInTheDocument();
    expect(screen.getByTestId("delve-graph")).toBeInTheDocument();
    // Six rooms, five doors — first-descent.json's own shape.
    expect(screen.getByTestId("delve-room-s-1")).toBeInTheDocument();
    expect(screen.getByTestId("delve-room-s-6")).toBeInTheDocument();
    expect(screen.getByTestId("delve-door-l-gate")).toBeInTheDocument();
    expect(getStageMountCount("delve")).toBe(1);
    expect(screen.queryByTestId("delve-stage-panel")).not.toBeInTheDocument();
  });

  it("renders no Rail — correctly excluded from GG-7's Sanctum-layer reachability matrix, not silently forgotten by it", () => {
    // checkpoint-f.spec.ts's own GG-7 matrix checks only Sanctum's 7 rail layers; delve is not a
    // rail entry at all (spec-delve-stage.md §4: "The rail does not grow") — the identical shape
    // SiegeStage.test.tsx already established for siege, proven structurally here rather than
    // asserted in prose: this stage never renders a `<Rail>`, so there is no rail-driven layer for
    // the GG-7 matrix to check.
    renderWithProviders(<DelveStage />, { route: "/delve/abc" });
    expect(screen.queryByTestId("rail")).not.toBeInTheDocument();
  });

  it("Route_round_trips_with_open_panel — #/delve/abc?panel=pack opens the real Pack panel (D5.7)", () => {
    renderWithProviders(
      <Routes>
        <Route path="/delve/:delveId" element={<DelveStage />} />
      </Routes>,
      { route: "/delve/abc?panel=pack" }
    );

    expect(screen.getByTestId("delve-stage-panel")).toBeInTheDocument();
    // D5.7 replaces the D5.1 placeholder with the real six-panel switch — this is now the Pack panel's
    // own real content, not a "later pass" stand-in.
    expect(screen.getByTestId("delve-panel-pack")).toBeInTheDocument();
    expect(screen.queryByTestId("delve-stage-panel-placeholder")).not.toBeInTheDocument();
    // The graph stays mounted underneath — band-2 panels overlay the stage, they do not replace it
    // (spec §7: "Never unmounted by a panel").
    expect(screen.getByTestId("delve-graph")).toBeInTheDocument();
  });

  it("Route_round_trips_with_every_panel — every one of the six ?panel= ids cold-loads stage-then-panel, and Esc returns to the bare stage URL with the panel gone (D5.7, spec-delve-stage.md §4/§14)", async () => {
    for (const panelId of Object.keys(PANEL_CONTENT_TESTID) as (keyof typeof PANEL_CONTENT_TESTID)[]) {
      resetStageMountCounts();
      resetKeymapForTests();
      useLayerStack.setState({ layers: [] });
      const user = userEvent.setup();

      const { unmount } = renderWithProviders(
        <Routes>
          <Route
            path="/delve/:delveId"
            element={
              <>
                <LocationSearchProbe />
                <DelveStage />
              </>
            }
          />
        </Routes>,
        { route: `/delve/abc?panel=${panelId}`, withGlobalKeys: true }
      );

      // Cold load restores the stage FIRST, then opens the panel (§4, verbatim) — both are present at
      // once on this very first render, not one then the other after some delay.
      expect(screen.getByTestId("delve-stage-frame")).toBeInTheDocument();
      expect(screen.getByTestId("delve-graph")).toBeInTheDocument();
      expect(screen.getByTestId("delve-stage-panel")).toBeInTheDocument();
      // The matching panel's own real content renders — not merely "a panel is open" (a placeholder
      // would satisfy that weaker claim; this asserts the actual per-id switch in DelvePanelHost.tsx).
      expect(screen.getByTestId(PANEL_CONTENT_TESTID[panelId])).toBeInTheDocument();
      // No OTHER panel's own content is mounted alongside it.
      for (const [otherId, otherTestId] of Object.entries(PANEL_CONTENT_TESTID)) {
        if (otherId === panelId) continue;
        expect(screen.queryByTestId(otherTestId)).not.toBeInTheDocument();
      }

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByTestId("delve-stage-panel")).not.toBeInTheDocument());
      expect(screen.queryByTestId(PANEL_CONTENT_TESTID[panelId])).not.toBeInTheDocument();
      // The URL itself returns to the bare stage — the panel is gone from the route, not just the DOM.
      expect(screen.getByTestId("test-location-search")).toHaveTextContent("");
      expect(screen.getByTestId("delve-stage-frame")).toBeInTheDocument();
      expect(getStageMountCount("delve")).toBe(1);

      unmount();
    }
  });

  it("an unrecognised ?panel= value opens no panel, and the stage's own Esc claim still works (not swallowed by a dead panel state)", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/delve/:delveId" element={<DelveStage />} />
      </Routes>,
      { route: "/delve/abc?panel=some-future-panel-id", withGlobalKeys: true }
    );

    expect(screen.getByTestId("delve-stage-frame")).toBeInTheDocument();
    expect(screen.queryByTestId("delve-stage-panel")).not.toBeInTheDocument();
    // Nothing opened, so the stage's own empty-stack Esc claim is live — one entry, not zero — proving
    // the normalization doesn't leave Esc dead the way leaving the raw unrecognised string in place
    // would (the escape-claim effect only skips claiming while `panel` is non-null).
    expect(useLayerStack.getState().layers).toHaveLength(1);

    await user.click(screen.getByTestId("delve-room-s-1"));
    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-selected", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-selected", "false");
  });

  it("Esc_pops_one_panel_and_returns_to_the_same_stage_state — closes the panel, keeps the stage mounted", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DelveStage />, { route: "/delve/abc?panel=pack", withGlobalKeys: true });

    expect(screen.getByTestId("delve-stage-panel")).toBeInTheDocument();
    expect(getStageMountCount("delve")).toBe(1);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByTestId("delve-stage-panel")).not.toBeInTheDocument());
    expect(screen.getByTestId("delve-stage-frame")).toBeInTheDocument();
    expect(getStageMountCount("delve")).toBe(1);
  });

  it("claims exactly one entry on the escape stack for its mounted lifetime, and releases it on unmount (the WorldStage precedent named in spec-delve-stage.md §4 row 4)", () => {
    const { unmount } = renderWithProviders(<DelveStage />, { route: "/delve/abc" });
    expect(useLayerStack.getState().layers).toHaveLength(1);

    unmount();
    expect(useLayerStack.getState().layers).toHaveLength(0);
  });

  it("Esc reaches the stage's own claimed entry and now really does clear room selection (D5.4 — no longer the D5.1 no-op)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DelveStage />, { route: "/delve/abc", withGlobalKeys: true });
    expect(useLayerStack.getState().layers).toHaveLength(1);

    await user.click(screen.getByTestId("delve-room-s-1"));
    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-selected", "true");

    // handleEscape() runs the claimed callback's dispatch outside any React event handler, so the
    // resulting re-render must be flushed explicitly — the same `act(() => handleEscape())` shape
    // WorldStage.test.tsx:160 already uses whenever it asserts on the DOM afterward, not just on the
    // store.
    expect(() => act(() => handleEscape())).not.toThrow();
    // The entry is still there (Esc reached this stage's own claim, not the System layer)...
    expect(useLayerStack.getState().layers).toHaveLength(1);
    // ...and the callback it ran actually cleared the real selection state D5.1 had nothing to clear.
    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-selected", "false");
  });

  it("a room can be selected by click, and clicking empty graph background deselects it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DelveStage />, { route: "/delve/abc" });

    await user.click(screen.getByTestId("delve-room-s-2"));
    expect(screen.getByTestId("delve-room-s-2")).toHaveAttribute("data-selected", "true");

    await user.click(screen.getByTestId("delve-graph-viewport"));
    expect(screen.getByTestId("delve-room-s-2")).toHaveAttribute("data-selected", "false");
  });

  it("Esc_pops_one_panel_and_returns_to_the_same_graph_state — spec-delve-stage.md §14's own named test: selection and camera survive a panel open/close cycle", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/delve/:delveId" element={<DelveStageHarness />} />
      </Routes>,
      { route: "/delve/abc", withGlobalKeys: true }
    );

    // Selection: pick a room, then zoom so the camera is not sitting wherever the initial "fit" left it.
    await user.click(screen.getByTestId("delve-room-s-3"));
    expect(screen.getByTestId("delve-room-s-3")).toHaveAttribute("data-selected", "true");
    await user.click(screen.getByTestId("delve-graph-zoom-in"));
    const cameraBefore = screen.getByTestId("delve-graph-camera").getAttribute("style");

    // Open the panel via the SAME `useSearchParams` mechanism DelveStage's own real panel-opening
    // verb will eventually use (D5.7+) — a sibling render under the same route, never a remount.
    await user.click(screen.getByTestId("test-open-pack-panel"));
    await waitFor(() => expect(screen.getByTestId("delve-stage-panel")).toBeInTheDocument());
    expect(getStageMountCount("delve")).toBe(1);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("delve-stage-panel")).not.toBeInTheDocument());

    // Selection and camera both survived the round trip untouched.
    expect(screen.getByTestId("delve-room-s-3")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("delve-graph-camera").getAttribute("style")).toBe(cameraBefore);
    expect(getStageMountCount("delve")).toBe(1);
  });
});

describe("DelveStage — the fight drawn in place (D5.5)", () => {
  beforeEach(() => {
    resetStageMountCounts();
    resetKeymapForTests();
    useLayerStack.setState({ layers: [] });
  });

  it("the fixture-fallback route shows an active fight nested inside the same stage frame — never a route change, never a separate screen", () => {
    renderWithProviders(<DelveStage />, { route: "/delve/abc" });

    const frame = screen.getByTestId("delve-stage-frame");
    const graph = screen.getByTestId("delve-graph");
    expect(frame.contains(graph)).toBe(true);
    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-fight-expanded", "true");
    // The fight content is a DOM descendant of the very same graph/stage tree — not a second mounted
    // root, not a route change, not a dialog: this IS "a fight never mounts as a separate screen,"
    // proven via containment rather than eyeballed.
    expect(graph.contains(screen.getByTestId("delve-room-fight"))).toBe(true);
    expect(getStageMountCount("delve")).toBe(1);
  });

  it("the sight gate holds live through the whole stage: s-3 (Glimpse) never expands even though the demo wires a fight there too", () => {
    renderWithProviders(<DelveStage />, { route: "/delve/abc" });
    expect(screen.getByTestId("delve-room-s-3")).toHaveAttribute("data-fight-expanded", "false");
  });

  describe("gated to the fixture fallback alone", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("once real data loads, the demo fight never appears", async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            delveId: 999,
            worldId: "w-live",
            state: "Active",
            domainId: "d-live",
            raidMode: "solo",
            rungId: "r-1",
            soulsUnbanked: 0,
            revision: 1,
            rooms: [
              {
                sectorId: "s-1",
                rowIndex: 0,
                colIndex: 0,
                visited: true,
                cleared: false,
                keyForLaneId: null,
                sight: 2,
                kind: "fight",
                archetypeId: "a",
                eventId: null,
                resolvedKind: "fight",
                resolvedArchetypeId: "a",
                floorJson: null
              }
            ],
            doors: [],
            partyPositions: [],
            parties: []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      ) as unknown as typeof fetch;

      renderWithProviders(
        <Routes>
          <Route path="/delve/:delveId" element={<DelveStage />} />
        </Routes>,
        { route: "/delve/999" }
      );

      // Deliberately reuses the fixture's own "s-1" id (the same id `DEMO_ACTIVE_FIGHTS` keys off) so
      // this test proves the real thing: the SAME sectorId, once served by real data, no longer
      // expands. A first draft of this test asserted on `s-1` appearing at all — which is trivially
      // true even before the fetch resolves, since the bundled fixture already has an `s-1` too, so it
      // passed for the wrong reason without ever observing the live-data transition (self-caught by
      // this task's own required verification pass, not assumed clean). `cleared` is the one field
      // that genuinely differs between the fixture's `s-1` (`cleared: true`) and this mock's
      // (`cleared: false`) — waiting on it is what actually proves the live response landed.
      await waitFor(() => expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-cleared", "false"));
      expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-fight-expanded", "false");
    });
  });
});

describe("DelveStage — live data over the fixture (D5.4, the real GET /api/delve/{delveId} wire)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders GET /api/delve/{delveId}'s real response instead of the bundled fixture once it resolves", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          delveId: 999,
          worldId: "w-live",
          state: "Active",
          domainId: "d-live",
          raidMode: "solo",
          rungId: "r-1",
          soulsUnbanked: 0,
          revision: 1,
          rooms: [
            {
              sectorId: "live-only-room",
              rowIndex: 0,
              colIndex: 0,
              visited: true,
              cleared: false,
              keyForLaneId: null,
              sight: 2,
              kind: "fight",
              archetypeId: "a",
              eventId: null,
              resolvedKind: "fight",
              resolvedArchetypeId: "a",
              floorJson: null
            }
          ],
          doors: [],
          partyPositions: [],
          parties: []
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    renderWithProviders(
      <Routes>
        <Route path="/delve/:delveId" element={<DelveStage />} />
      </Routes>,
      { route: "/delve/999" }
    );

    await waitFor(() => expect(screen.getByTestId("delve-room-live-only-room")).toBeInTheDocument());
    expect(screen.queryByTestId("delve-room-s-1")).not.toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/delve/999"));
  });
});
