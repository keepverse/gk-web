import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import {
  claimApSlot,
  foldCacheClaim,
  parseClaimedCounts
} from "@/contract/adapt";
import type { CachePinView } from "@/contract/types";
import {
  CacheClaimPrompt,
  CacheClaimPromptContent,
  CachePinLayer,
  claimCommandId,
  detailForCommand
} from "./CacheClaimPrompt";
import { captureHeader, captureLoserToast } from "./captureNotice";

vi.mock("@/lib/bus/world", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus/world")>();
  return { ...actual, useClaimableCaches: vi.fn(), useWorldTurnReport: vi.fn(), useFileClaimCache: vi.fn() };
});

const bus = await import("@/lib/bus/world");
const mockUseClaimableCaches = vi.mocked(bus.useClaimableCaches);
const mockUseWorldTurnReport = vi.mocked(bus.useWorldTurnReport);
const mockUseFileClaimCache = vi.mocked(bus.useFileClaimCache);

/**
 * empire-inventory-surfaces `storage-cache-ui` §§Design 2–4 (plan Task 4D.2b):
 * fold unit + landmark tests for pin → prompt → fits/left-behind → pick-up
 * and the capture-loss toast wire.
 */

const count = (value: number) => ({ unit: "count" as const, value });

function pin(overrides: Partial<CachePinView> = {}): CachePinView {
  return {
    cacheId: "cc-1",
    placeKind: "world_sector",
    placeRef: "homeworld",
    sourceKind: "legion_death",
    itemCount: count(2),
    createdUtc: "2026-09-15T00:00:00Z",
    ...overrides
  };
}

const pinsDto = {
  worldId: "w-1",
  entityId: "e-dave-legion-1",
  asOfTurn: 3,
  caches: [
    { cacheId: "cc-1", placeKind: "world_sector", placeRef: "homeworld", sourceKind: "legion_death", itemCount: 2, createdUtc: "2026-09-15T00:00:00Z" },
    { cacheId: "cc-2", placeKind: "world_lane", placeRef: "lane-ember", sourceKind: "legion_death", itemCount: 1, createdUtc: "2026-09-15T00:00:00Z" }
  ]
};

function busMocks() {
  mockUseClaimableCaches.mockReturnValue({
    data: pinsDto,
    isLoading: false,
    isError: false,
    refetch: vi.fn()
  } as unknown as ReturnType<typeof bus.useClaimableCaches>);
  mockUseWorldTurnReport.mockReturnValue({
    data: { turn: 2, stateHash: "h", phases: [], entries: [] }
  } as unknown as ReturnType<typeof bus.useWorldTurnReport>);
  mockUseFileClaimCache.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ commandId: "c", ok: true, reason: "ok", replayed: false }),
    isPending: false
  } as unknown as ReturnType<typeof bus.useFileClaimCache>);
}

beforeEach(() => {
  vi.clearAllMocks();
  busMocks();
});

describe("parseClaimedCounts — byte-exact with the verb's ClaimDetail", () => {
  it("parses claimed:<c>+<s> into its two counts", () => {
    expect(parseClaimedCounts("cache.claimed:2+1")).toEqual({ claimed: 2, skipped: 1 });
    expect(parseClaimedCounts("cache.claimed:3+0")).toEqual({ claimed: 3, skipped: 0 });
  });

  it("rejects anything but two non-negative integers", () => {
    expect(parseClaimedCounts("cache.unreachable")).toBeNull();
    expect(parseClaimedCounts("cache.claimed:2")).toBeNull();
    expect(parseClaimedCounts("cache.claimed:2+1+0")).toBeNull();
    expect(parseClaimedCounts("cache.claimed:-1+0")).toBeNull();
    expect(parseClaimedCounts("cache.claimed:two+1")).toBeNull();
    expect(parseClaimedCounts("")).toBeNull();
  });
});

describe("foldCacheClaim — fits/left-behind off the feed, never predicted", () => {
  it("is unreadable before any resolution is on the feed (GG-15)", () => {
    expect(foldCacheClaim("e", "cc-1", null)).toMatchObject({ verdict: "unreadable", copyKey: null });
    expect(foldCacheClaim("e", "cc-1", "")).toMatchObject({ verdict: "unreadable", copyKey: null });
    expect(foldCacheClaim("e", "cc-1", "ok")).toMatchObject({ verdict: "unreadable", copyKey: null });
  });

  it("folds all-aboard vs partial off the verb's own counts", () => {
    expect(foldCacheClaim("e", "cc-1", "cache.claimed:3+0")).toMatchObject({
      claimed: 3,
      skipped: 0,
      verdict: "all-aboard",
      copyKey: "cache.claimed.all"
    });
    expect(foldCacheClaim("e", "cc-1", "cache.claimed:2+1")).toMatchObject({
      claimed: 2,
      skipped: 1,
      verdict: "partial",
      copyKey: "cache.claimed.partial"
    });
  });

  it("folds a stale pin off cache.unreachable, byte-matching the verb", () => {
    expect(foldCacheClaim("e", "cc-1", "cache.unreachable")).toMatchObject({
      verdict: "stale-pin",
      copyKey: "cache.gone"
    });
  });
});

describe("detailForCommand — subject IS the CommandId (4A.1's pass)", () => {
  const entries = [
    { subject: "t2-claim-cache-e1~cc-1", detail: "cache.claimed:2+1" },
    { subject: "t2-something-else", detail: "cache.claimed:9+9" }
  ];

  it("returns the latest detail filed under that command", () => {
    expect(detailForCommand(entries, "t2-claim-cache-e1~cc-1")).toBe("cache.claimed:2+1");
  });

  it("ignores entries filed under other commands and answers null when absent", () => {
    expect(detailForCommand(entries, "t2-claim-cache-e1~cc-9")).toBeNull();
    expect(detailForCommand([], "t2-claim-cache-e1~cc-1")).toBeNull();
    expect(detailForCommand(undefined, "t2-claim-cache-e1~cc-1")).toBeNull();
  });
});

describe("AP display slot — the number is the server-sent claimCostMilli, bound here, never authored", () => {
  it("slot binds the listing's live price, not a literal", () => {
    // 250 is the fixture's server value (mirrors tuning), not a client constant:
    // the slot must render whatever the listing carries.
    expect(claimApSlot(250)).toEqual({ costMilli: 250, label: "pick up (250 AP)" });
  });

  it("claimApSlot fills the slot from the passed number, never a literal", () => {
    expect(claimApSlot(250)).toEqual({ costMilli: 250, label: "pick up (250 AP)" });
    expect(claimApSlot(999).label).toBe("pick up (999 AP)");
  });

  it("claimCommandId keeps the queue's key shape, suffixed per cache", () => {
    const a = claimCommandId(3, "e1", "cc-1");
    const b = claimCommandId(3, "e1", "cc-2");
    expect(a).toBe("t3-claim-cache-e1~cc-1");
    expect(a).not.toBe(b);
    // Same cache retried: same key, so double-submit replays on CommandId.
    expect(claimCommandId(3, "e1", "cc-1")).toBe(a);
  });
});

describe("capture notice — header always, loser toast exactly once, winner silent", () => {
  it("header is the live read, never prettified", () => {
    expect(captureHeader("dave")).toBe("held by dave");
    expect(captureHeader(null)).toBe("held by —");
  });

  it("fires exactly one loser toast when the viewer held it last and another holds it now", () => {
    const toast = captureLoserToast({
      sectorId: "ember-hollow",
      ownerFactionId: "dave",
      viewerFactionId: "rhea",
      previousOwnerFactionId: "rhea"
    });
    expect(toast).not.toBeNull();
    expect(toast!.id).toBe("capture-loss-ember-hollow");
  });

  it("stays silent for the winner, the stranger, and first sight", () => {
    // Winner: the header already says "held by" them.
    expect(
      captureLoserToast({ sectorId: "s", ownerFactionId: "dave", viewerFactionId: "dave", previousOwnerFactionId: "rhea" })
    ).toBeNull();
    // Still held by the viewer: nothing changed hands.
    expect(
      captureLoserToast({ sectorId: "s", ownerFactionId: "rhea", viewerFactionId: "rhea", previousOwnerFactionId: "rhea" })
    ).toBeNull();
    // Stranger: never held it, silence is not their outcome.
    expect(
      captureLoserToast({ sectorId: "s", ownerFactionId: "dave", viewerFactionId: "rhea", previousOwnerFactionId: "mira" })
    ).toBeNull();
    // First sight: a header with no past answers nothing (no history line).
    expect(
      captureLoserToast({ sectorId: "s", ownerFactionId: "dave", viewerFactionId: "rhea", previousOwnerFactionId: null })
    ).toBeNull();
    expect(
      captureLoserToast({ sectorId: "s", ownerFactionId: "dave", viewerFactionId: "rhea", previousOwnerFactionId: undefined })
    ).toBeNull();
    expect(
      captureLoserToast({ sectorId: "s", ownerFactionId: "dave", viewerFactionId: null, previousOwnerFactionId: "rhea" })
    ).toBeNull();
  });
});

describe("pin presence == response presence (hidden-until-found, no client fog)", () => {
  it("renders one pin per listing entry, count-only", () => {
    renderWithProviders(
      <CachePinLayer pins={[pin(), pin({ cacheId: "cc-2", placeKind: "world_lane", placeRef: "lane-ember", itemCount: count(1) })]} entityId="e-dave-legion-1" asOfTurn={3} selectedCacheId={null} onPick={() => {}} />
    );
    expect(screen.getByTestId("cache-claim-layer")).toHaveAttribute("data-entity", "e-dave-legion-1");
    expect(screen.getByTestId("cache-pin-cc-1")).toHaveAttribute("data-place-kind", "world_sector");
    expect(screen.getByTestId("cache-pin-cc-1")).toHaveAttribute("data-item-count", "2");
    expect(screen.getByTestId("cache-pin-cc-2")).toHaveAttribute("data-place-kind", "world_lane");
    expect(screen.getByTestId("cache-pin-count-cc-1")).toHaveTextContent("2");
  });

  it("carries no position and no visibility member — no client fog to build on", () => {
    const p = pin();
    expect(p).not.toHaveProperty("atSectorId");
    expect(p).not.toHaveProperty("onLaneId");
    expect(p).not.toHaveProperty("visible");
    renderWithProviders(
      <CachePinLayer pins={[p]} entityId="e" asOfTurn={3} selectedCacheId={null} onPick={() => {}} />
    );
    expect(screen.getByTestId("cache-pin-cc-1")).not.toHaveAttribute("data-visible");
  });

  it("picking a pin opens the prompt for that cache", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CachePinLayer pins={[pin()]} entityId="e" asOfTurn={3} selectedCacheId={null} onPick={() => {}} />
    );
    await user.click(screen.getByTestId("cache-pin-glyph-cc-1"));
    expect(screen.getByTestId("cache-pin-cc-1")).toBeInTheDocument();
  });
});

describe("claim prompt landmarks (pure view, draft parity)", () => {
  function renderPrompt(outcomeDetail: string | null = null) {
    const noop = () => {};
    renderWithProviders(
      <CacheClaimPromptContent
        entityId="e-dave-legion-1"
        asOfTurn={3}
        pins={[pin()]}
        apSlot={claimApSlot(250)}
        selectedCacheId="cc-1"
        onSelectCache={noop}
        outcome={foldCacheClaim("e-dave-legion-1", "cc-1", outcomeDetail)}
        fileNote={null}
        actionPending={false}
        onPickUp={noop}
      />
    );
  }

  it("renders every draft landmark with the AP slot bound to claimCostMilli", () => {
    renderPrompt();
    expect(screen.getByTestId("cache-claim-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("cache-claim-title")).toBeInTheDocument();
    expect(screen.getByTestId("cache-claim-count")).toHaveTextContent("2 packs");
    expect(screen.getByTestId("cache-claim-search")).toBeInTheDocument();
    expect(screen.getByTestId("cache-claim-pickup")).toBeInTheDocument();
    expect(screen.getByTestId("cache-claim-ap")).toHaveTextContent("(250 AP)");
    expect(screen.getByTestId("cache-claim-report-note")).toHaveTextContent("As of turn 3");
  });

  it("paints fits and left-behind off the committed detail", () => {
    renderPrompt("cache.claimed:2+1");
    expect(screen.getByTestId("cache-claim-outcome-cc-1-fits")).toHaveTextContent("2 aboard");
    expect(screen.getByTestId("cache-claim-outcome-cc-1-left-behind")).toHaveTextContent("1 waits");
  });

  it("paints all-aboard with no left-behind row", () => {
    renderPrompt("cache.claimed:2+0");
    expect(screen.getByTestId("cache-claim-outcome-cc-1-fits")).toBeInTheDocument();
    expect(screen.queryByTestId("cache-claim-outcome-cc-1-left-behind")).not.toBeInTheDocument();
  });

  it("paints the stale-pin copy off cache.unreachable", () => {
    renderPrompt("cache.unreachable");
    expect(screen.getByTestId("cache-claim-outcome-cc-1-stale")).toBeInTheDocument();
  });
});

describe("one-scope reads — one legion's list per selection, never the empire", () => {
  it("reads exactly one legion's claimable caches per open", () => {
    renderWithProviders(
      <CacheClaimPrompt worldId="w-1" entityId="e-dave-legion-1" turn={3} />
    );
    expect(mockUseClaimableCaches).toHaveBeenCalledWith("w-1", "e-dave-legion-1");
    expect(
      mockUseClaimableCaches.mock.calls.every(([w, e]) => w === "w-1" && e === "e-dave-legion-1")
    ).toBe(true);
  });

  it("renders nothing without a selected legion", () => {
    const { container } = renderWithProviders(
      <CacheClaimPrompt worldId="w-1" entityId={null} turn={3} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("container — capture toast off the live header read", () => {
  function renderContainer(ownerFactionId: string | null, onNotify: (item: never) => void) {
    return renderWithProviders(
      <CacheClaimPrompt
        worldId="w-1"
        entityId="e-dave-legion-1"
        turn={3}
        sectorId="ember-hollow"
        ownerFactionId={ownerFactionId}
        viewerFactionId="rhea"
        onNotify={onNotify as (item: { id: string }) => void}
      />
    );
  }

  it("fires exactly one loser toast when the header stops naming the viewer", () => {
    const onNotify = vi.fn();
    const view = renderContainer("rhea", onNotify);
    expect(onNotify).not.toHaveBeenCalled();
    view.rerender(
      <CacheClaimPrompt
        worldId="w-1"
        entityId="e-dave-legion-1"
        turn={3}
        sectorId="ember-hollow"
        ownerFactionId="dave"
        viewerFactionId="rhea"
        onNotify={onNotify as (item: { id: string }) => void}
      />
    );
    expect(onNotify).toHaveBeenCalledTimes(1);
    expect(onNotify.mock.calls[0]![0]).toMatchObject({ id: "capture-loss-ember-hollow" });
  });

  it("fires no toast for the winner", () => {
    const onNotify = vi.fn();
    const view = renderContainer("rhea", onNotify);
    view.rerender(
      <CacheClaimPrompt
        worldId="w-1"
        entityId="e-dave-legion-1"
        turn={3}
        sectorId="ember-hollow"
        ownerFactionId="rhea"
        viewerFactionId="rhea"
        onNotify={onNotify as (item: { id: string }) => void}
      />
    );
    expect(onNotify).not.toHaveBeenCalled();
  });
});
