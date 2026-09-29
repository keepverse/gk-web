import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { adaptArmouryItem, adaptArmouryRow, adaptCombination } from "@/contract/adapt";
import { known } from "@/contract/pending";
import { renderWithProviders } from "@/test/render";
import type { ContainerView } from "@/contract/types";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import { CompareView } from "./CompareView";
import { Compendium } from "./Compendium";
import { ItemCard } from "./ItemCard";
import { RelicsLayer } from "./RelicsLayer";
import { SocketBench } from "./SocketBench";
import { CraftBench } from "./Workbench";

/**
 * item-content `item-naming` **T3 + T4** — every player-facing surface that used to print a raw id
 * where a name belongs.
 *
 * ⛔ **The assertion is the same on all five: no rendered TEXT matches an id shape.** Not "contains
 * the expected string" — that would pass while an id sat two nodes over. Ids remain on `data-testid`
 * and `title` attributes on purpose, and neither is text content, so a debug read loses nothing.
 *
 * Every fixture below is real shipped content, read out of the corpora rather than invented:
 * `item.humanoid-feet-a-001` / `"Quilted Sock"` (`base-types/footing/humanoid/a.json`),
 * `recipe.014` / `"Temper: Ultimate Enhancement"` and `recipe.022` / `"Socket: Gem Setting"`
 * (`recipes/recipes.json`), `gem.g1-001` / `"Ember Shard"` (`gems/g1.json`), `combo.pure-fire-3` and
 * `combo.ring-fire-ice` (`ResonanceGenerator`'s own generated ids), and `wallnut` / `坚果` /
 * `gameTypeId 3` (`CreatureSpeciesCatalog.Generated.cs`).
 */

/**
 * A kind-prefixed container/material/channel id — `definitions.md` §1 forces the prefix to match the
 * kind, so this catches every one of them at once. The retired `socket-word` spelling was dropped
 * 2026-09-23: SSH2.6 deleted its corpus and renamed the kind to `combination` in both ports' tables,
 * so `sockword.` can never appear legitimately again — keeping it here would let a RESURRECTED retired
 * id pass this guard, which is the opposite of what the guard is for.
 */
const RAW_ID =
  /\b(?:container|item|gem|combo|recipe|base|set|substrate|essence|catalyst|shard|combat|progression|resource|status|rarity|class|role|flavor)\.[a-z0-9]/i;

/** A full instance GUID, the shape the equip-target `<option>` used to print. */
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function expectNoRawId(node: HTMLElement) {
  const text = node.textContent ?? "";
  expect(text).not.toMatch(RAW_ID);
  expect(text).not.toMatch(GUID);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- shared real fixtures ------------------------------------------------------------------------

const ACTOR_GUID = "6f1c4a2e-98b7-4d3f-9a11-2c7e5b0d84af";

const SPECIES_CATALOG = {
  species: [
    { speciesId: "wallnut", name: "坚果", side: "plant", gameTypeId: 3, traitPool: [] },
    { speciesId: "pumpkin", name: "南瓜", side: "plant", gameTypeId: 24, traitPool: [] }
  ],
  traits: []
};

const ARMOURY_PAGE = {
  total: 1,
  unseen: 0,
  overReviewPressure: false,
  renderStrategy: "RenderAll",
  rows: [
    {
      instanceId: ACTOR_GUID.replace("6f1c", "9b2d"),
      containerId: "item.humanoid-feet-a-001",
      rarity: "fused",
      rarityOrdinal: 50,
      assigned: false,
      locked: false,
      unseen: false,
      stale: false,
      acquiredUtc: "2026-09-06T00:00:00Z",
      battleOnly: false,
      containerName: "Quilted Sock"
    }
  ]
};

const SURFACES = [
  { surface: "armoury", state: "Ready", unlockKey: "first-container-acquired" },
  { surface: "compendium", state: "Ready", unlockKey: "first-socketed-item" }
];

const RECIPES = [
  {
    recipeId: "recipe.014",
    name: "Temper: Ultimate Enhancement",
    operation: "temper",
    frame: "",
    outputKind: "mutation",
    outputRef: null
  }
];

const SOCKET_RECIPES = [
  {
    recipeId: "recipe.022",
    name: "Socket: Gem Setting",
    operation: "socket",
    frame: "",
    outputKind: "mutation",
    outputRef: null
  }
];

const BORE_RECIPES = [
  { recipeId: "recipe.019", name: "Bore: Open Metal", operation: "bore", frame: "", outputKind: "mutation", outputRef: null }
];

/** A real `POST /api/items/workbench/enhance` reply shape, so the click path renders its result. */
const ENHANCE_REPLY = {
  ok: true,
  verb: "enhance",
  reason: "",
  instanceId: "inst-1",
  recipeId: "recipe.014",
  opSeq: 1,
  replayed: false,
  outcome: "success",
  enhanceLevel: 1,
  pityCounter: 0,
  successMilli: 750,
  spent: [{ class: "Substrate", materialId: "substrate.humanoid.crude", qty: 4 }],
  granted: [],
  sockets: []
};

const HELD_INSERTS = [{ containerId: "gem.g1-001", name: "Ember Shard", element: "fire", qty: 3 }];

const COMBINATIONS = [
  {
    comboId: "combo.pure-fire-3",
    shape: "pure",
    state: "Active",
    distance: 0,
    missingFamilies: [],
    missingElements: [],
    grantedTier: 3
  },
  {
    comboId: "combo.ring-fire-ice",
    shape: "ring",
    state: "OneAway",
    distance: 1,
    missingFamilies: [],
    missingElements: ["ice"],
    grantedTier: 1
  }
];

/** One fetch stub that answers every route these surfaces read, by path. */
function routedFetch(over: Record<string, unknown> = {}) {
  return vi.fn().mockImplementation((url: string) => {
    const path = String(url);
    const body = (() => {
      for (const [fragment, value] of Object.entries(over)) if (path.includes(fragment)) return value;
      if (path.includes("/api/creatures/catalog")) return SPECIES_CATALOG;
      if (path.includes("/api/unique/actors?")) {
        return {
          playerId: 1,
          items: [
            { instanceId: ACTOR_GUID, playerId: 1, side: "plant", typeId: 3, phase: "Idle", level: 7, xp: 0, revision: 1 }
          ]
        };
      }
      if (path.includes("/equipment")) return { instanceId: ACTOR_GUID, phase: "Idle", items: [], modsJson: "{}" };
      if (path.includes("/api/relics")) return { items: [] };
      if (path.includes("/api/items/surfaces/")) return SURFACES;
      if (path.includes("/api/items/armoury/")) return ARMOURY_PAGE;
      if (path.includes("/api/items/assignments/")) return [];
      if (path.includes("/combinations")) return COMBINATIONS;
      if (path.includes("/api/items/workbench/inserts/")) return HELD_INSERTS;
      if (path.includes("/api/items/workbench/enhance")) return ENHANCE_REPLY;
      if (path.includes("/api/items/workbench/recipes")) {
        if (path.includes("operation=socket")) return SOCKET_RECIPES;
        if (path.includes("operation=bore")) return BORE_RECIPES;
        return RECIPES;
      }
      return [];
    })();
    return Promise.resolve({ ok: true, status: 200, json: async () => body });
  });
}

function card(over: Partial<ContainerView> = {}): ContainerView {
  return {
    instanceId: "i1",
    kind: "item",
    header: {
      name: "Quilted Sock",
      rarity: { id: "fused", ordinal: 50, display: "Fused", colour: "var(--color-rarity-fused)", pips: 5 },
      baseTypeAndClassNoun: "Quilted Sock"
    },
    requirements: { state: "absent" },
    baseStats: [],
    implicit: { state: "absent" },
    affixes: { state: "absent" },
    enhancement: { state: "absent" },
    sockets: { state: "absent" },
    set: { state: "absent" },
    grantedAction: { state: "absent" },
    footer: { state: "absent" },
    ...over
  } as ContainerView;
}

// ---- 1. the equip-target dropdown (RelicsLayer) ---------------------------------------------------

describe("T3 surface 1 — the equip-target option", () => {
  it("names the specimen by its species, never by its instance GUID", async () => {
    vi.stubGlobal("fetch", routedFetch());
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);

    const select = await screen.findByTestId("relics-actor-select");
    expectNoRawId(select);
    expect(select).toHaveTextContent("坚果");
    expect(select).toHaveTextContent("Lv 7");
  });
});

// ---- 2. the delta table's row labels (CompareView) -----------------------------------------------

describe("T3 surface 2 — the comparison's delta labels", () => {
  it("labels a delta row with the channel's own words, not its registered id", () => {
    window.__fusionRpgActorSurface = actorSurfaceFixture();
    renderWithProviders(
      <CompareView
        candidate={card()}
        incumbent={card()}
        payload={known({
          badge: { verdict: "sidegrade", label: "Sidegrade", shape: "◆" },
          groups: [
            {
              unit: "gameUnits",
              deltas: [
                {
                  channel: "combat.crit.rate.fire",
                  incumbent: { unit: "gameUnits", value: 71 },
                  candidate: { unit: "gameUnits", value: 62 },
                  delta: { unit: "gameUnits", value: -9 }
                }
              ]
            }
          ],
          trade: null,
          incomparableReason: null,
          meanRollQualityPerMille: null
        })}
      />
    );

    const row = screen.getByTestId("compare-delta-combat.crit.rate.fire");
    expectNoRawId(row);
    expect(row).toHaveTextContent("Crit chance · Fire");
    // The id is still reachable for a debug read — as an attribute, which is not text content.
    expect(row.querySelector("[title]")).toHaveAttribute("title", "combat.crit.rate.fire");
  });
});

// ---- 3. the combination row titles (Compendium / SocketBench / ItemCard) --------------------------

describe("T3 surface 3 — combination row titles", () => {
  it("the compendium titles a row with the combination's words, not its comboId", async () => {
    vi.stubGlobal("fetch", routedFetch());
    renderWithProviders(
      <Compendium
        open
        onOpenChange={() => {}}
        instanceId="inst-1"
        itemName="Quilted Sock"
        playerId={1}
        setDisclosure={{ state: "absent" }}
      />
    );

    const row = await screen.findByTestId("compendium-row-combo.pure-fire-3");
    expectNoRawId(row);
    expect(row).toHaveTextContent("Pure Fire 3");
  });

  it("the socket bench titles a row the same way, from the same adapter", async () => {
    vi.stubGlobal("fetch", routedFetch());
    renderWithProviders(
      <SocketBench
        open
        onOpenChange={() => {}}
        instanceId="inst-1"
        itemName="Quilted Sock"
        playerId={1}
        cells={[]}
      />
    );

    const row = await screen.findByTestId("bench-combo-combo.ring-fire-ice");
    expectNoRawId(row);
    expect(row).toHaveTextContent("Ring Fire Ice");
  });

  it("the item card's socket block does too", () => {
    renderWithProviders(
      <ItemCard
        item={card({
          sockets: known({ cells: [], combinations: COMBINATIONS.map(adaptCombination) })
        })}
      />
    );

    const line = screen.getByTestId("item-card-combination-combo.pure-fire-3");
    expectNoRawId(line);
    expect(line).toHaveTextContent("Pure Fire 3");
  });
});

// ---- 4. the armoury row's name (ArmouryList, via adapt's fallback) --------------------------------

describe("T3 surface 4 — the armoury row's name", () => {
  it("shows the base type's authored name, never the container id", async () => {
    vi.stubGlobal("fetch", routedFetch());
    const user = userEvent.setup();
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);

    await user.click(await screen.findByTestId("relics-tab-armoury"));
    const list = await screen.findByTestId("armoury-list");
    expectNoRawId(list);
    expect(within(list).getByText("Quilted Sock")).toBeInTheDocument();
  });

  it("a container with no corpus row says so — `?? containerId` is gone from the adapter", () => {
    const row = adaptArmouryRow({ ...ARMOURY_PAGE.rows[0]!, containerName: "" });
    expect(row.containerName).toBeNull();
    const view = adaptArmouryItem(row);
    expect(view.header.name).not.toMatch(RAW_ID);
    expect(view.header.name).toBe("Unnamed item");
  });
});

// ---- 5. the workbench's typed ids become pickers (T4) ---------------------------------------------

describe("T4 — the bench picks by name instead of asking for a typed id", () => {
  it("the craft bench offers real temper recipes and no free-text id box", async () => {
    vi.stubGlobal("fetch", routedFetch());
    renderWithProviders(
      <CraftBench open onOpenChange={() => {}} instanceId="inst-1" itemName="Quilted Sock" playerId={1} />
    );

    const picker = await screen.findByTestId("craft-enhance-recipe");
    expect(picker.tagName).toBe("SELECT");
    expectNoRawId(picker);
    expect(picker).toHaveTextContent("Temper: Ultimate Enhancement");
    // The id is the option's value — never what a player reads.
    expect(within(picker).getByRole("option", { name: "Temper: Ultimate Enhancement" })).toHaveValue(
      "recipe.014"
    );
  });

  it("picking a recipe posts that recipe's id, so the pick is a real substitute for typing it", async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderWithProviders(
      <CraftBench open onOpenChange={() => {}} instanceId="inst-1" itemName="Quilted Sock" playerId={1} />
    );

    await user.selectOptions(await screen.findByTestId("craft-enhance-recipe"), "recipe.014");
    await user.click(screen.getByTestId("craft-enhance-btn"));

    const posted = fetchMock.mock.calls.find((c) => String(c[0]).includes("/workbench/enhance"))!;
    expect(JSON.parse(posted[1].body as string)).toMatchObject({ recipeId: "recipe.014" });
  });

  it("the socket bench picks the insert the player holds, by its authored name", async () => {
    vi.stubGlobal("fetch", routedFetch());
    renderWithProviders(
      <SocketBench
        open
        onOpenChange={() => {}}
        instanceId="inst-1"
        itemName="Quilted Sock"
        playerId={1}
        cells={[]}
      />
    );

    const picker = await screen.findByTestId("bench-insert-container");
    expect(picker.tagName).toBe("SELECT");
    // The held list arrives on its own read, so the option is awaited rather than assumed present.
    expect(await within(picker).findByRole("option", { name: /Ember Shard/ })).toHaveValue("gem.g1-001");
    expectNoRawId(picker);

    const recipePicker = screen.getByTestId("bench-insert-recipe");
    expectNoRawId(recipePicker);
    expect(recipePicker).toHaveTextContent("Socket: Gem Setting");
  });
});
