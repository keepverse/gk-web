import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, screen } from "@testing-library/react";
import { adaptEquipAssignments, adaptEquipOutcome } from "@/contract/adapt";
import { renderWithProviders } from "@/test/render";
import {
  useEquipItem,
  useItemAssignments,
  useUnequipItem,
  type ItemAssignmentDto,
  type ItemEquipOutcomeDto
} from "@/lib/bus/items";
import { Paperdoll, paperdollCells } from "./Paperdoll";

/**
 * item module 4's equip verbs, as the client sends them.
 *
 * ⭐ **Every fixture below is a real response body**, captured verbatim from the published server
 * running against a real stored item and a real bound specimen — not a shape invented to match the
 * adapter. A wire change breaks this file rather than the surface.
 */

const SPECIMEN = "387bbbbfdddb40138aa6e7165d6b27f5";
const BLADE = "10b4111299c74d5ba01db759979aafeb";
const HELM = "34943b9e07674edb8f6a5ffe04f85b4f";

/** `POST /api/items/equip` — the blade into `armament-primary` on an empty role. */
const EQUIP_OK: ItemEquipOutcomeDto = {
  ok: true,
  verb: "equip",
  reason: "",
  specimenId: SPECIMEN,
  role: "armament-primary",
  refKind: "rolled",
  refId: BLADE,
  replaced: null,
  assignments: [
    { role: "armament-primary", refKind: "rolled", refId: BLADE, assignedUtc: "2026-09-06T10:55:40.1577822Z" }
  ]
};

/** `POST /api/items/equip` — 409, a head-guard aimed at armament-primary. */
const EQUIP_ROLE_MISMATCH: ItemEquipOutcomeDto = {
  ok: false,
  verb: "equip",
  reason: `equip.role-mismatch: '${HELM}' is a 'head-guard' item, not a 'armament-primary'`,
  specimenId: SPECIMEN,
  role: "armament-primary",
  refKind: "rolled",
  refId: HELM,
  replaced: null,
  assignments: [
    { role: "armament-primary", refKind: "rolled", refId: BLADE, assignedUtc: "2026-09-06T10:55:40.1577822Z" }
  ]
};

/** `POST /api/items/unequip` — the role emptied, the piece named. */
const UNEQUIP_OK: ItemEquipOutcomeDto = {
  ok: true,
  verb: "unequip",
  reason: "",
  specimenId: SPECIMEN,
  role: "armament-primary",
  refKind: "rolled",
  refId: BLADE,
  replaced: { role: "armament-primary", refKind: "rolled", refId: BLADE, assignedUtc: "2026-09-06T10:55:40.1577822Z" },
  assignments: []
};

/** `GET /api/items/assignments/{specimen}` with one item and one relic in place. */
const ASSIGNMENTS: ItemAssignmentDto[] = [
  { role: "armament-primary", refKind: "rolled", refId: BLADE, assignedUtc: "2026-09-06T10:55:40.1577822Z" },
  { role: "core-guard", refKind: "stock", refId: "relic.tidewrack_band", assignedUtc: "2026-09-06T10:57:49.7141595Z" }
];

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => body });
}

function client() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function bodyOf(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0]![1].body as string);
}

describe("equip requests (item module 4)", () => {
  it("equip posts the specimen, the item and the role — and no correlation id, because it debits nothing", async () => {
    const fetchMock = okFetch(EQUIP_OK);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEquipItem(), { wrapper: wrapper(client()) });

    await result.current.mutateAsync({ playerId: 1, specimenId: SPECIMEN, instanceId: BLADE, role: "armament-primary" });

    expect(fetchMock.mock.calls[0]![0]).toContain("/api/items/equip");
    expect(fetchMock.mock.calls[0]![1].method).toBe("POST");
    expect(bodyOf(fetchMock)).toEqual({
      playerId: 1,
      specimenId: SPECIMEN,
      instanceId: BLADE,
      role: "armament-primary"
    });
    expect(bodyOf(fetchMock)).not.toHaveProperty("correlationId");
  });

  it("unequip names the role, never the item — a role holds one thing and that is the whole address", async () => {
    const fetchMock = okFetch(UNEQUIP_OK);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useUnequipItem(), { wrapper: wrapper(client()) });

    await result.current.mutateAsync({ playerId: 1, specimenId: SPECIMEN, role: "armament-primary" });

    expect(fetchMock.mock.calls[0]![0]).toContain("/api/items/unequip");
    expect(bodyOf(fetchMock)).toEqual({ playerId: 1, specimenId: SPECIMEN, role: "armament-primary" });
  });

  it("the assignment read goes to module 4's own route, not the relic layer's three-slot projection", async () => {
    const fetchMock = okFetch(ASSIGNMENTS);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useItemAssignments(SPECIMEN), { wrapper: wrapper(client()) });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock.mock.calls[0]![0]).toContain(`/api/items/assignments/${SPECIMEN}`);
    expect(fetchMock.mock.calls[0]![0]).not.toContain("/api/unique/actors");
  });

  it("a 409 refusal surfaces the server's own named rule, not a rewritten one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => EQUIP_ROLE_MISMATCH })
    );
    const { result } = renderHook(() => useEquipItem(), { wrapper: wrapper(client()) });

    await expect(
      result.current.mutateAsync({ playerId: 1, specimenId: SPECIMEN, instanceId: HELM, role: "armament-primary" })
    ).rejects.toThrow(/equip\.role-mismatch.*head-guard/);
  });
});

describe("adaptEquipOutcome / adaptEquipAssignments", () => {
  it("turns the wire's `refKind` into the word the surface acts on", () => {
    expect(adaptEquipAssignments(ASSIGNMENTS)).toEqual([
      { role: "armament-primary", source: "item", refId: BLADE, assignedUtc: "2026-09-06T10:55:40.1577822Z" },
      { role: "core-guard", source: "relic", refId: "relic.tidewrack_band", assignedUtc: "2026-09-06T10:57:49.7141595Z" }
    ]);
  });

  it("drops a role this build does not know rather than rendering it under an invented name", () => {
    expect(
      adaptEquipAssignments([
        { role: "left-antenna", refKind: "rolled", refId: "x", assignedUtc: "2026-09-06T00:00:00Z" }
      ])
    ).toEqual([]);
  });

  it("carries the displaced piece through, so a swap can say what came off", () => {
    expect(adaptEquipOutcome(UNEQUIP_OK).replaced).toEqual({
      role: "armament-primary",
      source: "item",
      refId: BLADE,
      assignedUtc: "2026-09-06T10:55:40.1577822Z"
    });
    expect(adaptEquipOutcome(EQUIP_OK).replaced).toBeNull();
  });
});

describe("Paperdoll — both flows, one screen", () => {
  it("fills a cell from an item's own role and from a relic's legacy slot word", () => {
    const cells = paperdollCells([
      { role: "head-guard", instanceId: HELM, itemName: "Proof Helm", rarity: null, source: "item" },
      { slot: "weapon", instanceId: "relic.ashen_reliquary", itemName: "Ashen Reliquary", rarity: null, source: "relic" }
    ]);
    expect(cells.find((c) => c.role === "head-guard")!.source).toBe("item");
    expect(cells.find((c) => c.role === "armament-primary")!.source).toBe("relic");
    expect(cells.find((c) => c.role === "footing")!.source).toBeNull();
  });

  it("R3, fixed 2026-09-08: a 'trinket' relic draws at jewel-minor-a (ring-1), matching Core's own LegacyEquipSlots alias — not jewel-major (neck), which is what this table said before the fix", () => {
    const cells = paperdollCells([
      { slot: "trinket", instanceId: "relic.cracked_seal", itemName: "Cracked Seal", rarity: null, source: "relic" }
    ]);
    expect(cells.find((c) => c.role === "jewel-minor-a")!.source).toBe("relic");
    expect(cells.find((c) => c.role === "jewel-major")!.source).toBeNull();
  });

  it("offers Take off only on an item cell — a relic's own flow rebuilds mods it cannot see from here", () => {
    renderWithProviders(
      <Paperdoll
        worn={[
          { role: "head-guard", instanceId: HELM, itemName: "Proof Helm", rarity: null, source: "item" },
          { slot: "weapon", instanceId: "relic.ashen_reliquary", itemName: "Ashen Reliquary", rarity: null, source: "relic" }
        ]}
        selectedId={null}
        onSelect={() => {}}
        onUnequip={() => {}}
      />
    );

    expect(screen.getByTestId("paperdoll-unequip-head-guard")).toBeInTheDocument();
    expect(screen.queryByTestId("paperdoll-unequip-armament-primary")).not.toBeInTheDocument();
    expect(screen.getByTestId("paperdoll-relic-note-armament-primary")).toHaveTextContent("Held tab");
  });

  it("draws no Take off at all when the caller has no write path to offer", () => {
    renderWithProviders(
      <Paperdoll
        worn={[{ role: "head-guard", instanceId: HELM, itemName: "Proof Helm", rarity: null, source: "item" }]}
        selectedId={null}
        onSelect={() => {}}
      />
    );

    expect(screen.queryByTestId("paperdoll-unequip-head-guard")).not.toBeInTheDocument();
  });
});
