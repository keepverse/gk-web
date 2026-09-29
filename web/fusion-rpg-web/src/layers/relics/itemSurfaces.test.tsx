import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import {
  adaptArmouryPage,
  adaptCombinations,
  adaptItemCard,
  adaptItemCompare,
  adaptItemSurfaces
} from "@/contract/adapt";
import type { ItemCardDto, ItemCompareDto } from "@/lib/bus/items";
import { absent, known, pendingWithReason } from "@/contract/pending";
import type { ArmouryFilterState, ArmouryRowView, ContainerView } from "@/contract/types";
import { renderWithProviders } from "@/test/render";
import { applyArmouryFilter, sortArmoury } from "./ArmouryList";
import { CompareView } from "./CompareView";
import { ItemCard } from "./ItemCard";
import { paperdollCells } from "./Paperdoll";

function row(over: Partial<ArmouryRowView> & { instanceId: string }): ArmouryRowView {
  return {
    containerId: "item.plate-helm.fused",
    rarity: { id: "fused", ordinal: 50, display: "Fused", colour: "var(--color-rarity-fused)", pips: 5 },
    role: absent(),
    frame: absent(),
    assigned: false,
    locked: false,
    unseen: false,
    stale: false,
    acquiredUtc: "2026-09-01T00:00:00Z",
    ...over
  };
}

const NO_FILTER: ArmouryFilterState = {
  rarityMin: null,
  rarityMax: null,
  unseenOnly: false,
  hideAssigned: false,
  hideStale: false,
  sort: "acquired"
};

function card(over: Partial<ContainerView> = {}): ContainerView {
  return {
    instanceId: "i1",
    kind: "item",
    header: {
      name: "Ashen Reliquary",
      rarity: { id: "chaff", ordinal: 10, display: "Chaff", colour: "var(--color-rarity-chaff)", pips: 1 },
      baseTypeAndClassNoun: "Relic"
    },
    requirements: absent(),
    baseStats: [],
    implicit: absent(),
    affixes: absent(),
    enhancement: absent(),
    sockets: absent(),
    set: absent(),
    grantedAction: absent(),
    footer: absent(),
    ...over
  };
}

describe("armoury view rules (item module 20)", () => {
  it("never hides a locked row, whatever the filter asks for", () => {
    const rows = [
      row({ instanceId: "locked", locked: true, stale: true, assigned: true }),
      row({ instanceId: "plain" })
    ];
    const hideEverything: ArmouryFilterState = {
      ...NO_FILTER,
      rarityMin: 100,
      unseenOnly: true,
      hideAssigned: true,
      hideStale: true
    };
    expect(applyArmouryFilter(rows, hideEverything).map((r) => r.instanceId)).toEqual(["locked"]);
  });

  it("no filter setting reduces the collection below what it matches — it is a view, not a cap", () => {
    const rows = [row({ instanceId: "a" }), row({ instanceId: "b" }), row({ instanceId: "c" })];
    expect(applyArmouryFilter(rows, NO_FILTER)).toHaveLength(3);
  });

  it("sorts rarest first, and falls back to newest within a rung", () => {
    const rows = [
      row({ instanceId: "old-fused", acquiredUtc: "2026-01-01T00:00:00Z" }),
      row({
        instanceId: "chaff",
        rarity: { id: "chaff", ordinal: 10, display: "Chaff", colour: "c", pips: 1 }
      }),
      row({ instanceId: "new-fused", acquiredUtc: "2026-09-05T00:00:00Z" })
    ];
    expect(sortArmoury(rows, "rarity").map((r) => r.instanceId)).toEqual([
      "new-fused",
      "old-fused",
      "chaff"
    ]);
  });
});

describe("item surface adapters", () => {
  it("renames the wire's states without re-deciding any of them", () => {
    const views = adaptItemSurfaces([
      { surface: "armoury", state: "Ready", unlockKey: "first-container-acquired" },
      { surface: "compendium", state: "Locked", unlockKey: "first-socketed-item" },
      { surface: "notASurface", state: "Ready", unlockKey: "x" }
    ]);
    expect(views).toEqual([
      { surface: "armoury", state: "ready", unlockKey: "first-container-acquired" },
      { surface: "compendium", state: "locked", unlockKey: "first-socketed-item" }
    ]);
  });

  it("counts the inbox over the whole armoury, not the page it was handed", () => {
    const page = adaptArmouryPage({
      total: 900,
      unseen: 61,
      overReviewPressure: true,
      renderStrategy: "Virtualize",
      rows: [
        {
          instanceId: "i1",
          containerId: "c1",
          rarity: "fused",
          rarityOrdinal: 50,
          assigned: false,
          locked: false,
          unseen: true,
          stale: false,
          acquiredUtc: "2026-09-01T00:00:00Z"
        }
      ]
    });
    expect(page.inbox.total.value).toBe(900);
    expect(page.inbox.unseen.value).toBe(61);
    expect(page.rows).toHaveLength(1);
    expect(page.strategy).toBe("virtualize");
    expect(page.rows[0]!.rarity.display).toBe("Fused");
  });

  it("keeps infinity a nullable rather than a large number, and drops what was never revealed", () => {
    const combos = adaptCombinations([
      {
        comboId: "combo.ember",
        shape: "pure",
        state: "OneAway",
        distance: 1,
        missingFamilies: ["gem.ember"],
        missingElements: [],
        grantedTier: 2
      },
      {
        comboId: "combo.hidden",
        shape: "strain",
        state: "SomethingElse",
        distance: null,
        missingFamilies: [],
        missingElements: [],
        grantedTier: 0
      }
    ]);
    expect(combos.map((c) => c.comboId)).toEqual(["combo.ember"]);
    expect(combos[0]!.distance).toBe(1);
  });
});

/**
 * The wire payload `GET /api/items/{instanceId}/card` actually returns, block for block — the same
 * shape `ItemCardEndpointsTests` asserts on the server side, so a change on either end breaks a test
 * on the other rather than only at runtime.
 */
function cardDto(over: Partial<ItemCardDto> = {}): ItemCardDto {
  return {
    instanceId: "i1",
    fingerprint: "item.card.header\n  item.card.header|-|-|0|-|-|-\n",
    blocks: [
      {
        blockKey: "item.card.header",
        lines: [
          {
            key: "item.card.header",
            args: {
              pips: "7",
              rungKey: "rarity.heirloom",
              colorHex: "#8a6",
              name: "base.honed-hatchet",
              baseNameKey: "base.honed-hatchet",
              classNounKey: "class.blade",
              roleNameKey: "role.armament-primary",
              frame: "humanoid",
              ilvl: "24",
              enhance: "+3"
            },
            unit: null,
            sourceKind: null,
            groupOrder: 0,
            rollBarSegments: null,
            contextRead: null,
            rollQualityPerMille: null
          }
        ]
      },
      {
        blockKey: "item.card.affixes",
        lines: [
          {
            key: "disptpl.affix.elpw-pierce",
            args: { value: "+142", element: "fire", __rendered: "+142 fire penetration" },
            unit: "GameUnits",
            sourceKind: "AffixPrefix",
            groupOrder: 1,
            rollBarSegments: 4,
            contextRead: null,
            rollQualityPerMille: 734
          }
        ]
      },
      {
        blockKey: "item.card.footer",
        lines: [
          {
            key: "item.card.footer",
            args: { meanRollQuality: "73.4%", stale: "0", locked: "1", noReassign: "0" },
            unit: null,
            sourceKind: null,
            groupOrder: 0,
            rollBarSegments: null,
            contextRead: null,
            rollQualityPerMille: null
          }
        ]
      }
    ],
    ...over
  };
}

describe("the rendered card (item module 10)", () => {
  it("takes the rarity's three channels off the card rather than re-deriving any of them", () => {
    const view = adaptItemCard(cardDto());
    expect(view.header.rarity.id).toBe("heirloom");
    expect(view.header.rarity.pips).toBe(7);
    expect(view.header.itemLevel).toBe(24);
    expect(view.header.enhancementPrefix).toBe("+3 ");
    // Never promoted ⇒ the mark is absent, not "promoted from nothing".
    expect(view.header.promotedFromRarity).toBeUndefined();
  });

  it("carries the promotion mark when the item climbed, resolved off the same ladder", () => {
    const dto = cardDto();
    dto.blocks[0]!.lines[0]!.args.promotedFromKey = "rarity.cultivated";
    const view = adaptItemCard(dto);
    expect(view.header.promotedFromRarity?.id).toBe("cultivated");
    expect(view.header.promotedFromRarity?.display).toBe("Cultivated");
  });

  it("renders no promotion mark for a rung key the shipped ladder does not carry", () => {
    const dto = cardDto();
    dto.blocks[0]!.lines[0]!.args.promotedFromKey = "rarity.not-a-rung";
    expect(adaptItemCard(dto).header.promotedFromRarity).toBeUndefined();
  });

  it("shows the RENDERER's own sentence for an affix line and composes nothing itself", () => {
    const line = adaptItemCard(cardDto()).affixes;
    expect(line.state).toBe("known");
    if (line.state !== "known") return;
    expect(line.value[0]!.rendered).toBe("+142 fire penetration");
    // `__rendered` is the sentence, not an argument the template still needs.
    expect(line.value[0]!.args.__rendered).toBeUndefined();
    expect(line.value[0]!.args.value).toBe("+142");
    expect(line.value[0]!.unit).toBe("gameUnits");
    expect(line.value[0]!.sourceKind).toBe("affix-prefix");
    expect(line.value[0]!.rollBarSegments).toBe(4);
  });

  it("keeps a structural line's unit and source kind null — naming one would be the lie SC4 forbids", () => {
    const view = adaptItemCard(cardDto());
    expect(view.footer.state).toBe("known");
    // The header is structural, and its own block is not exposed as lines — but the footer's is the
    // same shape, and the renderer gave neither a unit.
    const affix = view.affixes;
    expect(affix.state).toBe("known");
  });

  it("passes the footer's mean roll through as the renderer formatted it, never as a number", () => {
    const footer = adaptItemCard(cardDto()).footer;
    expect(footer.state).toBe("known");
    if (footer.state !== "known") return;
    expect(footer.value.meanRollQuality).toBe("73.4%");
    expect(footer.value.locked).toBe(true);
    expect(footer.value.stale).toBe(false);
  });

  it("says `absent` for a block the renderer emitted empty — never `pending`, the route answered", () => {
    const view = adaptItemCard(cardDto());
    expect(view.enhancement.state).toBe("absent");
    expect(view.set.state).toBe("absent");
  });

  // ---- flavour (item-content T6) ------------------------------------------------------------------

  /** One flavour block, as the card route emits it once the string catalog resolves the key. */
  function withFlavour(args: Record<string, string>): ItemCardDto {
    const dto = cardDto();
    return {
      ...dto,
      blocks: [
        ...dto.blocks,
        {
          blockKey: "item.card.flavour",
          lines: [
            {
              key: "item.card.flavour",
              args,
              unit: null,
              sourceKind: "UniqueIdentity",
              groupOrder: 0,
              rollBarSegments: null,
              contextRead: null,
              rollQualityPerMille: null
            }
          ]
        }
      ]
    };
  }

  it("shows the AUTHORED sentence for a unique's flavour, never a fragment of its key", () => {
    const real =
      "It doesn't wait for the battlefield to finish. It roots in mid-fight and blooms before the body is cold.";
    const view = adaptItemCard(
      withFlavour({ flavourKey: "flavor.unique.carrion-spitter", __rendered: real })
    );
    expect(view.flavour).toBe(real);
    // The old `keyTail` placeholder would have produced exactly this.
    expect(view.flavour).not.toBe("carrion spitter");
  });

  it("shows a SET's authored sentence through the same block (owner decision 2026-09-06)", () => {
    const real = "It has never once composed a line of its own, only reproduced the last hand's exactly.";
    const view = adaptItemCard(withFlavour({ flavourKey: "flavor.set.copyhand", __rendered: real }));
    expect(view.flavour).toBe(real);
  });

  it("shows NOTHING when the key has no catalog row — a key tail is not prose", () => {
    const view = adaptItemCard(withFlavour({ flavourKey: "flavor.unique.no-string-row" }));
    expect(view.flavour).toBeUndefined();
  });

  it("shows nothing when no flavour was authored at all", () => {
    expect(adaptItemCard(cardDto()).flavour).toBeUndefined();
  });
});

describe("the comparison payload (item modules 13 + 20)", () => {
  function compareDto(over: Partial<ItemCompareDto> = {}): ItemCompareDto {
    return {
      incumbent: cardDto({ instanceId: "old" }),
      candidate: cardDto({ instanceId: "new" }),
      differingLineIndexes: [1],
      deltas: [
        { channel: "combat.hp", unit: "GameUnits", incumbent: 71, candidate: 62, delta: -9, incumbentMax: null, candidateMax: null },
        { channel: "defense", unit: "PerMilleRatio", incumbent: 0, candidate: 140, delta: 140, incumbentMax: null, candidateMax: null }
      ],
      dominance: "Sidegrade",
      badge: { labelKey: "item.compare.sidegrade", shape: "◆" },
      trade: {
        youGain: [{ channel: "defense", unit: "PerMilleRatio", incumbent: 0, candidate: 140, delta: 140, incumbentMax: null, candidateMax: null }],
        youGiveUp: [{ channel: "combat.hp", unit: "GameUnits", incumbent: 71, candidate: 62, delta: -9, incumbentMax: null, candidateMax: null }]
      },
      unitGroups: [
        { unit: "GameUnits", deltas: [{ channel: "combat.hp", unit: "GameUnits", incumbent: 71, candidate: 62, delta: -9, incumbentMax: null, candidateMax: null }] },
        { unit: null, deltas: [{ channel: "mystery", unit: null, incumbent: 1, candidate: 2, delta: 1, incumbentMax: null, candidateMax: null }] }
      ],
      meanRollQualityMilliIncumbent: 500,
      meanRollQualityMilliCandidate: 734,
      footnoteKey: "item.compare.no-single-score",
      incomparableReasonKey: null,
      ...over
    };
  }

  it("carries the server's verdict as a word AND a shape, and invents no scalar", () => {
    const view = adaptItemCompare(compareDto());
    expect(view.badge.verdict).toBe("sidegrade");
    expect(view.badge.shape).toBe("◆");
    expect(Object.keys(view)).not.toContain("score");
  });

  it("keeps an unresolvable unit in its OWN group rather than folding it into game units", () => {
    const view = adaptItemCompare(compareDto());
    expect(view.groups.map((g) => g.unit)).toEqual(["gameUnits", null]);
  });

  it("labels a per-mille delta as a proportion, never as a flat count", () => {
    const view = adaptItemCompare(compareDto());
    const gain = view.trade!.youGain[0]!;
    expect(gain.delta.unit).toBe("perMilleRatio");
    expect(gain.delta.op).toBe("more");
    expect(gain.delta.value).toBe(140);
  });

  it("draws the trade only for a sidegrade — every other verdict word already says it all", () => {
    expect(adaptItemCompare(compareDto({ dominance: "StrictlyBetter" })).trade).toBeNull();
    expect(adaptItemCompare(compareDto()).trade).not.toBeNull();
  });

  it("names the reason for an incomparable verdict, because one with no explanation reads as a bug", () => {
    const view = adaptItemCompare(
      compareDto({ dominance: "Incomparable", incomparableReasonKey: "item.compare.incomparable-reason" })
    );
    expect(view.badge.verdict).toBe("incomparable");
    expect(view.incomparableReason).toBe("incomparable reason");
  });
});

describe("ItemCard", () => {
  it("renders all eleven blocks, with identity above the detail zone", () => {
    renderWithProviders(<ItemCard item={card({ flavour: "Warm to the touch." })} />);
    const identity = screen.getByTestId("item-card-identity");
    const detail = screen.getByTestId("item-card-detail");

    for (const block of ["header", "requirements", "base-stats", "implicit", "affixes", "enhancement"]) {
      expect(identity).toContainElement(screen.getByTestId(`item-card-${block}`));
    }
    for (const block of ["sockets", "set", "granted-action", "flavour", "footer"]) {
      expect(detail).toContainElement(screen.getByTestId(`item-card-${block}`));
    }
  });

  it("shows the rarity rung as pips AND as a word, never as colour alone", () => {
    renderWithProviders(<ItemCard item={card()} />);
    expect(screen.getByTestId("item-card-rarity")).toHaveTextContent("Chaff");
  });

  it("names the item it is being read against when there is one", () => {
    renderWithProviders(
      <ItemCard item={card()} incumbent={card({ header: { ...card().header, name: "Sunworn Charm" } })} />
    );
    expect(screen.getByTestId("item-card-incumbent")).toHaveTextContent("Sunworn Charm");
  });
});

describe("CompareView", () => {
  it("keeps the no-single-score footnote on screen with no way to dismiss it", () => {
    renderWithProviders(
      <CompareView candidate={card()} incumbent={null} payload={pendingWithReason("Not shown yet")} />
    );
    const footnote = screen.getByTestId("compare-footnote");
    expect(footnote).toHaveTextContent("There is no single score");
    expect(footnote.querySelector("button")).toBeNull();
  });

  it("puts the unit in the group header, never in the numeric column", () => {
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
                  channel: "combat.hp",
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
    const group = screen.getByTestId("compare-group-gameUnits");
    expect(group).toHaveTextContent("Damage and hit points");
    expect(screen.getByTestId("compare-verdict")).toHaveTextContent("Sidegrade");
  });
});

describe("Paperdoll", () => {
  it("always shows every role, filled or not — an equip screen has to show what is missing", () => {
    const cells = paperdollCells([
      { slot: "weapon", instanceId: "r1", itemName: "Ashen Reliquary", rarity: null }
    ]);
    expect(cells).toHaveLength(16);
    expect(cells.find((c) => c.role === "armament-primary")!.itemName).toBe("Ashen Reliquary");
    expect(cells.find((c) => c.role === "footing")!.instanceId).toBeNull();
  });

  it("carries both frame names for every role, because nothing says which frame is worn", () => {
    const cells = paperdollCells([]);
    const mainHand = cells.find((c) => c.role === "armament-primary")!;
    expect(mainHand.humanoidName).toBe("main-hand");
    expect(mainHand.plantName).toBe("muzzle");
  });
});

/**
 * P8.4 — the multi-set per-piece disclosure rides the EXISTING set block.
 *
 * Module 12's own measured corpus fact is the reason: 25 of the 154 shipped (role, base type) member
 * pairs belong to more than one set, one to three, so a card that renders only the first set has
 * rendered at most a third of the truth. The extra sets arrive as `item.card.set.other` lines beside
 * the header and the ladder — never a second block and never a second route.
 */
describe("the set block reports every set a piece touches", () => {
  const setLine = (key: string, args: Record<string, string>) => ({
    key,
    args,
    unit: "Count",
    sourceKind: "SetThreshold",
    groupOrder: 0,
    rollBarSegments: null,
    contextRead: null,
    rollQualityPerMille: null
  });

  it("puts every advancing set in advances and every redundant one in redundantIn", () => {
    const dto = cardDto({
      blocks: [
        {
          blockKey: "item.card.set",
          lines: [
            setLine("item.card.set.header", {
              nameKey: "set.alpha",
              name: "Alpha Set",
              count: "3",
              total: "4",
              redundant: "0"
            }),
            setLine("item.card.set.threshold", { pieces: "2", active: "1", capability: "0" }),
            setLine("item.card.set.other", {
              nameKey: "set.beta",
              name: "Beta Set",
              count: "1",
              total: "3",
              redundant: "0"
            }),
            setLine("item.card.set.other", {
              nameKey: "set.gamma",
              name: "Gamma Set",
              count: "2",
              total: "2",
              redundant: "1"
            })
          ]
        }
      ]
    });

    const view = adaptItemCard(dto).set;
    expect(view.state).toBe("known");
    if (view.state !== "known") return;
    expect(view.value.advances).toEqual(["Alpha Set", "Beta Set"]);
    expect(view.value.redundantIn).toEqual(["Gamma Set"]);
  });

  it("leaves a lone set reading exactly as it did before", () => {
    const dto = cardDto({
      blocks: [
        {
          blockKey: "item.card.set",
          lines: [
            setLine("item.card.set.header", {
              nameKey: "set.alpha",
              name: "Alpha Set",
              count: "1",
              total: "4",
              redundant: "0"
            })
          ]
        }
      ]
    });

    const view = adaptItemCard(dto).set;
    expect(view.state).toBe("known");
    if (view.state !== "known") return;
    expect(view.value.advances).toEqual(["Alpha Set"]);
    expect(view.value.redundantIn).toEqual([]);
  });
});

/**
 * P8.4, the rendering half. The adapter put every set a piece advances into `advances`; without a line
 * that SHOWS them, the disclosure stops at the view model and the player still sees one "3 / 4".
 */
describe("the card renders the other sets a piece advances", () => {
  const setBlock = (names: { name: string; count: string; total: string; redundant: string }[]) => ({
    blockKey: "item.card.set",
    lines: [
      {
        key: "item.card.set.header",
        args: {
          nameKey: "set.alpha",
          name: names[0]!.name,
          count: names[0]!.count,
          total: names[0]!.total,
          redundant: names[0]!.redundant
        },
        unit: "Count",
        sourceKind: "SetThreshold",
        groupOrder: 0,
        rollBarSegments: null,
        contextRead: null,
        rollQualityPerMille: null
      },
      ...names.slice(1).map((peer) => ({
        key: "item.card.set.other",
        args: {
          nameKey: `set.${peer.name.toLowerCase().replace(/ /g, "-")}`,
          name: peer.name,
          count: peer.count,
          total: peer.total,
          redundant: peer.redundant
        },
        unit: "Count",
        sourceKind: "SetThreshold",
        groupOrder: 0,
        rollBarSegments: null,
        contextRead: null,
        rollQualityPerMille: null
      }))
    ]
  });

  it("names the other advancing sets beside the primary one", () => {
    const view = adaptItemCard(
      cardDto({
        blocks: [
          setBlock([
            { name: "Alpha Set", count: "3", total: "4", redundant: "0" },
            { name: "Beta Set", count: "1", total: "3", redundant: "0" },
            { name: "Gamma Set", count: "2", total: "2", redundant: "1" }
          ])
        ]
      })
    );

    renderWithProviders(<ItemCard item={view} />);

    // The primary is the header; the OTHER advancing set gets its own line.
    expect(screen.getByTestId("item-card-set-also-advances").textContent).toContain("Beta Set");
    // …and the redundant one is named by the existing warn line, not by the new one.
    expect(screen.getByTestId("item-card-set-redundant").textContent).toContain("Gamma Set");
    expect(screen.getByTestId("item-card-set-also-advances").textContent).not.toContain("Gamma Set");
  });

  it("says nothing extra for a piece that advances exactly one set", () => {
    const view = adaptItemCard(
      cardDto({
        blocks: [setBlock([{ name: "Alpha Set", count: "1", total: "4", redundant: "0" }])]
      })
    );

    renderWithProviders(<ItemCard item={view} />);

    expect(screen.queryByTestId("item-card-set-also-advances")).toBeNull();
    expect(screen.queryByTestId("item-card-set-redundant")).toBeNull();
  });
});
