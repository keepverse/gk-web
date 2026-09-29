import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { adaptWorkbenchOutcome } from "@/contract/adapt";
import { renderWithProviders } from "@/test/render";
import {
  useEnhanceItem,
  useSalvageItem,
  useSocketAdd,
  useSocketInsert,
  useUpcycleMaterials,
  useUpgradeItem,
  useUpgradePreview,
  type WorkbenchOutcomeDto,
  type WorkbenchUpgradePreviewDto
} from "@/lib/bus/items";
import { SocketBench } from "./SocketBench";
import { CraftBench, UpgradeConsumedNotice, UpgradeSwapLine, WorkbenchResult } from "./Workbench";

/**
 * item modules 14/15/16's write verbs, as the client sends them.
 *
 * ⭐ **Every fixture below is a real response body**, captured verbatim from the shipped executor
 * running against a real stored item — not a shape invented to match the adapter. That is the whole
 * point of pinning them here: the adapter is asserted against what the server actually sends, so a
 * wire change breaks this file rather than the surface.
 *
 * The other half of the pin is the request: each hook is asserted to post the exact URL and body
 * that those captured responses came back from.
 */

// ---- real captured bodies ----------------------------------------------------------------------

/** `POST /api/items/workbench/socket-add`, second bore on a socketMax=2 base type. */
const SOCKET_ADD_OK: WorkbenchOutcomeDto = {
  ok: true,
  verb: "socket-add",
  reason: "",
  instanceId: "wb-proof-inst-1",
  recipeId: "recipe.019",
  opSeq: 2,
  replayed: false,
  outcome: "socket-add",
  enhanceLevel: 0,
  pityCounter: 0,
  successMilli: 0,
  spent: [
    { class: "Souls", materialId: "", qty: 200 },
    { class: "Substrate", materialId: "substrate.humanoid.sound", qty: 12 },
    { class: "Catalyst", materialId: "catalyst.forge", qty: 1 }
  ],
  granted: [],
  sockets: [
    { index: 0, affinity: "", crafted: true, insert: null },
    { index: 1, affinity: "", crafted: true, insert: null }
  ]
};

/** `POST /api/items/workbench/enhance` — a successful temper. */
const ENHANCE_OK: WorkbenchOutcomeDto = {
  ok: true,
  verb: "enhance",
  reason: "",
  instanceId: "wb-proof-inst-1",
  recipeId: "recipe.012",
  opSeq: 3,
  replayed: false,
  outcome: "success",
  enhanceLevel: 1,
  pityCounter: 0,
  successMilli: 1000,
  spent: [
    { class: "Souls", materialId: "", qty: 15 },
    { class: "Substrate", materialId: "substrate.humanoid.crude", qty: 1 },
    { class: "Catalyst", materialId: "catalyst.temper", qty: 1 }
  ],
  granted: [],
  sockets: [
    { index: 0, affinity: "", crafted: true, insert: null },
    { index: 1, affinity: "", crafted: true, insert: null }
  ]
};

/** `POST /api/items/workbench/salvage` — the item's disposition became `salvaged`. */
const SALVAGE_OK: WorkbenchOutcomeDto = {
  ok: true,
  verb: "salvage",
  reason: "",
  instanceId: "wb-proof-inst-1",
  recipeId: "",
  opSeq: 0,
  replayed: false,
  outcome: "salvaged",
  enhanceLevel: 1,
  pityCounter: 0,
  successMilli: 0,
  spent: [],
  granted: [
    { class: "Shard", materialId: "shard.grafted", qty: 1 },
    { class: "Substrate", materialId: "substrate.humanoid.crude", qty: 4 }
  ],
  sockets: []
};

/** The 409 body a refused operation returns. `reason` is what `httpErrorMessage` lifts out. */
const REFUSAL_BODY = {
  ok: false,
  verb: "socket-add",
  reason:
    "ContentRuleViolated: socket.no-free-socket: the item is already at its base type's socketMax of 2 — the fix is to accept the cap, not to empty a socket",
  instanceId: "wb-proof-inst-1",
  recipeId: "recipe.019",
  opSeq: 0,
  replayed: false,
  outcome: "refused",
  enhanceLevel: 0,
  pityCounter: 0,
  successMilli: 0,
  spent: [],
  granted: [],
  sockets: []
};

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => body });
}

/**
 * item-content `item-naming` T4: both benches now READ their recipe list (and the socket bench its
 * held inserts) before they can offer a pick, so a stub that answers only the write route leaves
 * every picker empty. These are the real shipped rows for the two verbs these tests drive.
 */
const BORE_RECIPES = [
  { recipeId: "recipe.019", name: "Bore: Open Metal", operation: "bore", frame: "", outputKind: "mutation", outputRef: null }
];

/** `okFetch` for a write route, with the bench's own reads answered beside it. */
function benchFetch(writeBody: unknown) {
  return vi.fn().mockImplementation((url: string) => {
    const path = String(url);
    const body = path.includes("/workbench/recipes")
      ? path.includes("operation=bore")
        ? BORE_RECIPES
        : []
      : path.includes("/workbench/inserts/")
        ? []
        : writeBody;
    return Promise.resolve({ ok: true, status: 200, json: async () => body });
  });
}

function client() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function bodyOf(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0]![1].body as string);
}

describe("workbench requests (item modules 14/15/16)", () => {
  it("salvage posts only the instance — no recipe and no correlation, because it debits nothing", async () => {
    const fetchMock = okFetch(SALVAGE_OK);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSalvageItem(), { wrapper: wrapper(client()) });

    await result.current.mutateAsync({ playerId: 1, instanceId: "wb-proof-inst-1" });

    expect(fetchMock.mock.calls[0]![0]).toContain("/api/items/workbench/salvage");
    expect(fetchMock.mock.calls[0]![1].method).toBe("POST");
    expect(bodyOf(fetchMock)).toEqual({ playerId: 1, instanceId: "wb-proof-inst-1" });
  });

  it("upcycle posts a recipe and a correlation, and no instance — it touches no item", async () => {
    const fetchMock = okFetch({ ...SALVAGE_OK, verb: "upcycle", outcome: "upcycled" });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useUpcycleMaterials(), { wrapper: wrapper(client()) });

    await result.current.mutateAsync({ playerId: 1, recipeId: "recipe.005", correlationId: "c-1" });

    expect(fetchMock.mock.calls[0]![0]).toContain("/api/items/workbench/upcycle");
    expect(bodyOf(fetchMock)).toEqual({ playerId: 1, recipeId: "recipe.005", correlationId: "c-1" });
  });

  it("enhance posts the instance, the recipe and the correlation — never a ward flag", async () => {
    const fetchMock = okFetch(ENHANCE_OK);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEnhanceItem(), { wrapper: wrapper(client()) });

    await result.current.mutateAsync({
      playerId: 1,
      instanceId: "wb-proof-inst-1",
      recipeId: "recipe.012",
      correlationId: "c-2"
    });

    expect(fetchMock.mock.calls[0]![0]).toContain("/api/items/workbench/enhance");
    expect(bodyOf(fetchMock)).toEqual({
      playerId: 1,
      instanceId: "wb-proof-inst-1",
      recipeId: "recipe.012",
      correlationId: "c-2"
    });
  });

  it("socket-add and socket-insert post to their own routes with their own fields", async () => {
    const addFetch = okFetch(SOCKET_ADD_OK);
    vi.stubGlobal("fetch", addFetch);
    const add = renderHook(() => useSocketAdd(), { wrapper: wrapper(client()) });
    await add.result.current.mutateAsync({
      playerId: 1,
      instanceId: "wb-proof-inst-1",
      recipeId: "recipe.019",
      correlationId: "c-3"
    });
    expect(addFetch.mock.calls[0]![0]).toContain("/api/items/workbench/socket-add");
    expect(bodyOf(addFetch)).toEqual({
      playerId: 1,
      instanceId: "wb-proof-inst-1",
      recipeId: "recipe.019",
      correlationId: "c-3"
    });

    vi.unstubAllGlobals();
    const insertFetch = okFetch({ ...SOCKET_ADD_OK, verb: "socket-insert" });
    vi.stubGlobal("fetch", insertFetch);
    const insert = renderHook(() => useSocketInsert(), { wrapper: wrapper(client()) });
    await insert.result.current.mutateAsync({
      playerId: 1,
      instanceId: "wb-proof-inst-1",
      recipeId: "recipe.022",
      insertContainerId: "gem.ember",
      correlationId: "c-4"
    });
    expect(insertFetch.mock.calls[0]![0]).toContain("/api/items/workbench/socket-insert");
    expect(bodyOf(insertFetch)).toEqual({
      playerId: 1,
      instanceId: "wb-proof-inst-1",
      recipeId: "recipe.022",
      insertContainerId: "gem.ember",
      correlationId: "c-4"
    });
  });

  it("a 409 refusal surfaces the server's own named rule, not a rewritten one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => REFUSAL_BODY })
    );
    const { result } = renderHook(() => useSocketAdd(), { wrapper: wrapper(client()) });

    await expect(
      result.current.mutateAsync({
        playerId: 1,
        instanceId: "wb-proof-inst-1",
        recipeId: "recipe.019",
        correlationId: "c-5"
      })
    ).rejects.toThrow(/socket\.no-free-socket/);
  });
});

describe("adaptWorkbenchOutcome", () => {
  it("labels every quantity as a count and composes none of them", () => {
    const view = adaptWorkbenchOutcome(SOCKET_ADD_OK);
    expect(view.spent.map((l) => [l.materialId, l.qty.value])).toEqual([
      ["", 200],
      ["substrate.humanoid.sound", 12],
      ["catalyst.forge", 1]
    ]);
    expect(view.spent.every((l) => l.qty.unit === "count")).toBe(true);
  });

  it("an empty affinity and an empty insert are `null`, because absent is not a value", () => {
    // `insertName` (item-content T4) follows the same rule: `""` on the wire and an absent field
    // are both `null`, because an empty cell has no name any more than it has a container.
    expect(adaptWorkbenchOutcome(SOCKET_ADD_OK).sockets).toEqual([
      { index: 0, affinity: null, crafted: true, insertContainerId: null, insertName: null },
      { index: 1, affinity: null, crafted: true, insertContainerId: null, insertName: null }
    ]);
  });

  it("only the verb that rolls carries a chance — a socket op gets null, never 0‰", () => {
    expect(adaptWorkbenchOutcome(ENHANCE_OK).successChance).toEqual({
      unit: "perMilleRatio",
      value: 1000,
      op: "flat"
    });
    expect(adaptWorkbenchOutcome(SOCKET_ADD_OK).successChance).toBeNull();
    expect(adaptWorkbenchOutcome(SALVAGE_OK).successChance).toBeNull();
  });
});

describe("WorkbenchResult", () => {
  it("shows the spend and the yield the server reported, and nothing it did not", () => {
    renderWithProviders(<WorkbenchResult outcome={adaptWorkbenchOutcome(SALVAGE_OK)} />);
    // item-content T3/T4: a material line renders the id's own WORDS. The id itself is still on
    // the row's `title`, which is an attribute and not text content.
    expect(screen.getByTestId("workbench-result-granted")).toHaveTextContent("Shard grafted");
    expect(screen.getByTestId("workbench-result-granted")).toHaveTextContent("4");
    expect(screen.queryByTestId("workbench-result-spent")).not.toBeInTheDocument();
  });

  it("a failed enhance is reported as a failure even though the call returned 200", () => {
    renderWithProviders(
      <WorkbenchResult
        outcome={adaptWorkbenchOutcome({
          ...ENHANCE_OK,
          outcome: "failure",
          enhanceLevel: 0,
          pityCounter: 1
        })}
      />
    );
    const panel = screen.getByTestId("workbench-result");
    expect(panel).toHaveAttribute("data-outcome", "failure");
    expect(panel).toHaveTextContent("The materials are spent either way");
  });

  it("a replayed operation says so instead of reading as a second spend", () => {
    renderWithProviders(
      <WorkbenchResult outcome={adaptWorkbenchOutcome({ ...ENHANCE_OK, replayed: true, outcome: "replay" })} />
    );
    expect(screen.getByTestId("workbench-result")).toHaveTextContent("already done");
  });
});

describe("SocketBench writes", () => {
  function open() {
    return renderWithProviders(
      <SocketBench
        open
        onOpenChange={() => {}}
        instanceId="wb-proof-inst-1"
        itemName="Proof Blade"
        playerId={1}
        cells={[]}
      />
    );
  }

  it("refuses to send a bore with no recipe picked, and says why on the control", async () => {
    vi.stubGlobal("fetch", benchFetch([]));
    open();
    const button = screen.getByTestId("bench-socket-add-btn");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Pick a bore recipe first");
  });

  it("posts a real socket-add once a recipe is picked, and renders the sockets the server returned", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes("/workbench/socket-add"))
        return Promise.resolve({ ok: true, json: async () => SOCKET_ADD_OK });
      if (path.includes("/workbench/recipes") && path.includes("operation=bore"))
        return Promise.resolve({ ok: true, json: async () => BORE_RECIPES });
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    open();

    // item-content T4: picked by its real name, not typed as `recipe.019`.
    await user.selectOptions(await screen.findByTestId("bench-bore-recipe"), "recipe.019");
    await user.click(screen.getByTestId("bench-socket-add-btn"));

    const posted = fetchMock.mock.calls.find((c) => String(c[0]).includes("/workbench/socket-add"))!;
    expect(JSON.parse(posted[1].body as string)).toMatchObject({
      playerId: 1,
      instanceId: "wb-proof-inst-1",
      recipeId: "recipe.019"
    });
    // The correlation is minted per click, so its value is free — its presence is not.
    expect(JSON.parse(posted[1].body as string).correlationId).toMatch(/\S/);

    expect(await screen.findByTestId("bench-result")).toBeInTheDocument();
    expect(screen.getByTestId("bench-result-socket-1")).toBeInTheDocument();
  });

  it("imbue is offered as unavailable with a real reason, never as a control that can only fail", () => {
    vi.stubGlobal("fetch", benchFetch([]));
    open();
    const button = screen.getByTestId("bench-socket-imbue-btn");
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toMatch(/no recipe|none has been written/i);
    expect(screen.getByTestId("bench-imbue-reason")).toHaveTextContent("recipe");
  });
});

describe("CraftBench writes", () => {
  function open() {
    return renderWithProviders(
      <CraftBench
        open
        onOpenChange={() => {}}
        instanceId="wb-proof-inst-1"
        itemName="Proof Blade"
        playerId={1}
      />
    );
  }

  it("breaks the item down through the real route and reports the yield the server sent", async () => {
    const fetchMock = benchFetch(SALVAGE_OK);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    open();

    await user.click(screen.getByTestId("craft-salvage-btn"));

    // The bench reads its recipe list first (T4), so the write is found by name rather than by index.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/items/workbench/salvage"))).toBe(true);
    expect(await screen.findByTestId("craft-bench-result")).toHaveTextContent("salvaged");
    expect(screen.getByTestId("craft-bench-result-granted")).toHaveTextContent("Substrate humanoid crude");
  });

  it("prints a refusal exactly as the server named it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ ...REFUSAL_BODY, verb: "salvage", reason: "item.locked: 'x' is locked by its owner" })
      })
    );
    const user = userEvent.setup();
    open();

    await user.click(screen.getByTestId("craft-salvage-btn"));

    expect(await screen.findByTestId("craft-bench-error")).toHaveTextContent("item.locked");
  });

  it("names the three verbs no route serves, with the reason for each", () => {
    vi.stubGlobal("fetch", benchFetch({}));
    open();
    expect(screen.getByTestId("workbench-unavailable-forge")).toHaveTextContent("nothing for a forge recipe to produce");
    expect(screen.getByTestId("workbench-unavailable-reroll")).toBeInTheDocument();
    expect(screen.getByTestId("workbench-unavailable-transfer")).toBeInTheDocument();
  });
});

// ---- species-gear-chain T37: the upgrade's client wire and its swap line -------------------------

/** `POST /api/items/workbench/upgrade-preview`, captured from the shipped preview endpoint. */
const UPGRADE_PREVIEW_OK: WorkbenchUpgradePreviewDto = {
  ok: true,
  reason: "",
  instanceId: "wb-proof-inst-1",
  successorBaseTypeId: "item.humanoid-armament-primary-b-001",
  outgoingImplicitFamily: "implicit.cloth",
  incomingImplicitFamily: "implicit.leather",
  carriedAffixCount: 2,
  soulsCost: 240,
  spent: [{ class: "Souls", materialId: "", qty: 240 }]
};

/** `POST /api/items/workbench/upgrade`, captured from the shipped verb. */
const UPGRADE_OK: WorkbenchOutcomeDto = {
  ...SALVAGE_OK,
  verb: "upgrade",
  outcome: "upgraded",
  instanceId: "wb-proof-successor-1",
  spent: [{ class: "Souls", materialId: "", qty: 240 }],
  granted: []
};

describe("the upgrade's client wire", () => {
  it("previews with the preview route and no correlation id", async () => {
    const fetchMock = okFetch(UPGRADE_PREVIEW_OK);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpgradePreview(), { wrapper: wrapper(client()) });
    await result.current.mutateAsync({ playerId: 1, instanceId: "wb-proof-inst-1" });

    expect(fetchMock.mock.calls[0]![0]).toContain("/api/items/workbench/upgrade-preview");
    expect(fetchMock.mock.calls[0]![1].method).toBe("POST");
    expect(bodyOf(fetchMock)).toEqual({ playerId: 1, instanceId: "wb-proof-inst-1" });
  });

  it("commits with the upgrade route and a correlation id", async () => {
    const fetchMock = okFetch(UPGRADE_OK);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpgradeItem(), { wrapper: wrapper(client()) });
    await result.current.mutateAsync({
      playerId: 1,
      instanceId: "wb-proof-inst-1",
      correlationId: "corr-client-1"
    });

    expect(fetchMock.mock.calls[0]![0]).toContain("/api/items/workbench/upgrade");
    expect(bodyOf(fetchMock)).toEqual({
      playerId: 1,
      instanceId: "wb-proof-inst-1",
      correlationId: "corr-client-1"
    });
  });
});

describe("the upgrade's swap line", () => {
  it("shows both implicits, the carried count, the price and the chassis-not-successor sentence", () => {
    renderWithProviders(<UpgradeSwapLine preview={UPGRADE_PREVIEW_OK} />);

    const line = screen.getByTestId("craft-upgrade-swap");
    expect(line).toHaveTextContent("implicit.cloth");
    expect(line).toHaveTextContent("implicit.leather");
    expect(line).toHaveTextContent("2");
    expect(line).toHaveTextContent("240");
    // Success criterion 5, in the player's own words.
    expect(line).toHaveTextContent("carries its own identity");
  });

  it("shows the named refusal instead of a swap when the server refused", () => {
    renderWithProviders(
      <UpgradeSwapLine preview={{ ...UPGRADE_PREVIEW_OK, ok: false, reason: "upgrade.no-successor: no edge" }} />
    );

    expect(screen.getByTestId("craft-upgrade-refusal")).toHaveTextContent("upgrade.no-successor");
    expect(screen.queryByTestId("craft-upgrade-swap")).not.toBeInTheDocument();
  });

  it("says to preview first when nothing has been asked yet", () => {
    renderWithProviders(<UpgradeSwapLine preview={null} />);

    expect(screen.getByTestId("craft-upgrade-hint")).toHaveTextContent("Preview first");
  });
});

describe("the notice that an upgrade consumed the opened piece", () => {
  it("shows when the outcome is an upgrade into a different instance", () => {
    renderWithProviders(
      <UpgradeConsumedNotice
        outcome={{ ...UPGRADE_OK, verb: "upgrade", outcome: "upgraded", instanceId: "successor-1" }}
        openedInstanceId="wb-proof-inst-1"
      />
    );

    expect(screen.getByTestId("craft-upgrade-consumed")).toHaveTextContent("was consumed");
  });

  it("stays silent for another verb, and when the outcome is not a consume", () => {
    renderWithProviders(
      <UpgradeConsumedNotice outcome={{ ...UPGRADE_OK, verb: "enhance" }} openedInstanceId="wb-proof-inst-1" />
    );
    expect(screen.queryByTestId("craft-upgrade-consumed")).not.toBeInTheDocument();

    renderWithProviders(
      <UpgradeConsumedNotice
        outcome={{ ...UPGRADE_OK, verb: "upgrade", outcome: "refused" }}
        openedInstanceId="wb-proof-inst-1"
      />
    );
    expect(screen.queryByTestId("craft-upgrade-consumed")).not.toBeInTheDocument();
  });

  it("stays silent when the outcome names the same instance (nothing was consumed)", () => {
    renderWithProviders(
      <UpgradeConsumedNotice
        outcome={{ ...UPGRADE_OK, verb: "upgrade", outcome: "upgraded", instanceId: "same-1" }}
        openedInstanceId="same-1"
      />
    );

    expect(screen.queryByTestId("craft-upgrade-consumed")).not.toBeInTheDocument();
  });
});
