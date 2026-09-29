import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import type { ItemPreviewDto } from "@/lib/bus/items";
import { AtomPreviewPage } from "./AtomPreviewPage";

/**
 * item-content module `atom-preview` (T9) — the preview page, driven end to end over a REAL
 * container definition.
 *
 * ⭐ **`PREVIEW_OK` is a real captured response body**, not a shape invented to match the component:
 * it is `POST /api/items/preview/card` answering the definition in `DEFINITION` below, against the
 * shipped atom catalog and display templates, trimmed to the header and implicit blocks so the file
 * stays readable. The other half of the pin is the REQUEST — the page is asserted to post exactly
 * what was pasted into it, so a body the server never saw could not produce this fixture.
 *
 * The three cards' implicit lines are the point: `+19–37 attack` as the container really rolls, then
 * `+19` and `+37`, which are the two ends of that same authored range. Every one of those strings is
 * the server's own render; none is computed here.
 */

/** The definition pasted into the box — the same one the fixture below was captured from. */
const DEFINITION = {
  containerId: "item.preview-draft-blade",
  kind: "Item",
  slot: "armament-primary",
  rarity: "heirloom",
  levelReq: 20,
  prefixRolls: 0,
  suffixRolls: 0,
  atoms: [
    { seq: 0, atomId: "atom.bulwark.t5" },
    { seq: 1, atomId: "atom.might.t5" },
    { seq: 2, atomId: "atom.savagery.t5" },
    { seq: 3, atomId: "atom.resilience.t5" }
  ],
  baseTypeId: "item.humanoid-main-hand-a-001",
  rollSeed: 12648430,
  itemLevel: 24
};

const PREVIEW_OK: ItemPreviewDto = {
    "containerId": "item.preview-draft-blade",
    "rollSeed": 12648430,
    "thetaContent": 20,
    "contentScaleMilli": 1000,
    "cards": [
      {
        "mode": "rolled",
        "card": {
          "instanceId": "preview:rolled",
          "blocks": [
            {
              "blockKey": "item.card.header",
              "lines": [
                {
                  "key": "item.card.header",
                  "args": {
                    "pips": "7",
                    "rungKey": "rarity.heirloom",
                    "colorHex": "#ff94d2",
                    "name": "base.honed-hatchet",
                    "baseNameKey": "base.honed-hatchet",
                    "baseName": "Honed Hatchet",
                    "classNounKey": "class.blade",
                    "roleNameKey": "role.armament-primary",
                    "frame": "humanoid",
                    "ilvl": "24"
                  },
                  "unit": null,
                  "sourceKind": null,
                  "groupOrder": 0,
                  "rollBarSegments": null,
                  "contextRead": null,
                  "rollQualityPerMille": null
                }
              ]
            },
            {
              "blockKey": "item.card.implicit",
              "lines": [
                {
                  "key": "disptpl.affix.might",
                  "args": {
                    "value": "19–37",
                    "__rendered": "+19–37 attack"
                  },
                  "unit": "GameUnits",
                  "sourceKind": "Implicit",
                  "groupOrder": 1,
                  "rollBarSegments": null,
                  "contextRead": null,
                  "rollQualityPerMille": null
                }
              ]
            }
          ],
          "fingerprint": "item.card.header\n  item.card.header|-|-|0|-|-|-|baseName=Honed Hatchet|baseNameKey=base.honed-hatchet|classNounKey=class.blade|colorHex=#ff94d2|frame=humanoid|ilvl=24|name=base.honed-hatchet|pips=7|roleNameKey=role.armament-primary|rungKey=rarity.heirloom\nitem.card.requirements\n  item.card.requirement.level|Count|-|0|-|-|-|have=0|met=0|need=20\nitem.card.base-stats\n  disptpl.affix.resilience|GameUnits|Base|0|-|-|-|__rendered=219–435% increased defense for the whole army|value=219–435\n  disptpl.affix.savagery|GameUnits|Base|1|-|-|-|__rendered=×120–238 attack|value=120–238\n  disptpl.affix.bulwark|GameUnits|Base|2|-|-|-|__rendered=120–238 more max health|value=120–238\nitem.card.implicit\n  disptpl.affix.might|GameUnits|Implicit|1|-|-|-|__rendered=+19–37 attack|value=19–37\nitem.card.affixes\nitem.card.enhancement\nitem.card.sockets\nitem.card.set\nitem.card.granted-action\nitem.card.flavour\nitem.card.footer\n  item.card.footer|-|-|0|-|-|-|locked=0|meanRollQuality=|noReassign=0|stale=0\n"
        }
      },
      {
        "mode": "min",
        "card": {
          "instanceId": "preview:min",
          "blocks": [
            {
              "blockKey": "item.card.header",
              "lines": [
                {
                  "key": "item.card.header",
                  "args": {
                    "pips": "7",
                    "rungKey": "rarity.heirloom",
                    "colorHex": "#ff94d2",
                    "name": "base.honed-hatchet",
                    "baseNameKey": "base.honed-hatchet",
                    "baseName": "Honed Hatchet",
                    "classNounKey": "class.blade",
                    "roleNameKey": "role.armament-primary",
                    "frame": "humanoid",
                    "ilvl": "24"
                  },
                  "unit": null,
                  "sourceKind": null,
                  "groupOrder": 0,
                  "rollBarSegments": null,
                  "contextRead": null,
                  "rollQualityPerMille": null
                }
              ]
            },
            {
              "blockKey": "item.card.implicit",
              "lines": [
                {
                  "key": "disptpl.affix.might",
                  "args": {
                    "value": "19",
                    "__rendered": "+19 attack"
                  },
                  "unit": "GameUnits",
                  "sourceKind": "Implicit",
                  "groupOrder": 1,
                  "rollBarSegments": null,
                  "contextRead": null,
                  "rollQualityPerMille": null
                }
              ]
            }
          ],
          "fingerprint": "item.card.header\n  item.card.header|-|-|0|-|-|-|baseName=Honed Hatchet|baseNameKey=base.honed-hatchet|classNounKey=class.blade|colorHex=#ff94d2|frame=humanoid|ilvl=24|name=base.honed-hatchet|pips=7|roleNameKey=role.armament-primary|rungKey=rarity.heirloom\nitem.card.requirements\n  item.card.requirement.level|Count|-|0|-|-|-|have=0|met=0|need=20\nitem.card.base-stats\n  disptpl.affix.resilience|GameUnits|Base|0|-|-|-|__rendered=219% increased defense for the whole army|value=219\n  disptpl.affix.savagery|GameUnits|Base|1|-|-|-|__rendered=×120 attack|value=120\n  disptpl.affix.bulwark|GameUnits|Base|2|-|-|-|__rendered=120 more max health|value=120\nitem.card.implicit\n  disptpl.affix.might|GameUnits|Implicit|1|-|-|-|__rendered=+19 attack|value=19\nitem.card.affixes\nitem.card.enhancement\nitem.card.sockets\nitem.card.set\nitem.card.granted-action\nitem.card.flavour\nitem.card.footer\n  item.card.footer|-|-|0|-|-|-|locked=0|meanRollQuality=|noReassign=0|stale=0\n"
        }
      },
      {
        "mode": "max",
        "card": {
          "instanceId": "preview:max",
          "blocks": [
            {
              "blockKey": "item.card.header",
              "lines": [
                {
                  "key": "item.card.header",
                  "args": {
                    "pips": "7",
                    "rungKey": "rarity.heirloom",
                    "colorHex": "#ff94d2",
                    "name": "base.honed-hatchet",
                    "baseNameKey": "base.honed-hatchet",
                    "baseName": "Honed Hatchet",
                    "classNounKey": "class.blade",
                    "roleNameKey": "role.armament-primary",
                    "frame": "humanoid",
                    "ilvl": "24"
                  },
                  "unit": null,
                  "sourceKind": null,
                  "groupOrder": 0,
                  "rollBarSegments": null,
                  "contextRead": null,
                  "rollQualityPerMille": null
                }
              ]
            },
            {
              "blockKey": "item.card.implicit",
              "lines": [
                {
                  "key": "disptpl.affix.might",
                  "args": {
                    "value": "37",
                    "__rendered": "+37 attack"
                  },
                  "unit": "GameUnits",
                  "sourceKind": "Implicit",
                  "groupOrder": 1,
                  "rollBarSegments": null,
                  "contextRead": null,
                  "rollQualityPerMille": null
                }
              ]
            }
          ],
          "fingerprint": "item.card.header\n  item.card.header|-|-|0|-|-|-|baseName=Honed Hatchet|baseNameKey=base.honed-hatchet|classNounKey=class.blade|colorHex=#ff94d2|frame=humanoid|ilvl=24|name=base.honed-hatchet|pips=7|roleNameKey=role.armament-primary|rungKey=rarity.heirloom\nitem.card.requirements\n  item.card.requirement.level|Count|-|0|-|-|-|have=0|met=0|need=20\nitem.card.base-stats\n  disptpl.affix.resilience|GameUnits|Base|0|-|-|-|__rendered=435% increased defense for the whole army|value=435\n  disptpl.affix.savagery|GameUnits|Base|1|-|-|-|__rendered=×238 attack|value=238\n  disptpl.affix.bulwark|GameUnits|Base|2|-|-|-|__rendered=238 more max health|value=238\nitem.card.implicit\n  disptpl.affix.might|GameUnits|Implicit|1|-|-|-|__rendered=+37 attack|value=37\nitem.card.affixes\nitem.card.enhancement\nitem.card.sockets\nitem.card.set\nitem.card.granted-action\nitem.card.flavour\nitem.card.footer\n  item.card.footer|-|-|0|-|-|-|locked=0|meanRollQuality=|noReassign=0|stale=0\n"
        }
      }
    ]
  };

function okFetch(bodyJson: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => bodyJson });
}

/** A refusal, exactly as the route sends it — `ok`/`reason`, which `httpErrorMessage` lifts. */
function refusingFetch(reason: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ ok: false, reason, containerId: DEFINITION.containerId })
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function paste(user: ReturnType<typeof userEvent.setup>, text: string) {
  const box = screen.getByTestId("atom-preview-json");
  await user.click(box);
  await user.paste(text);
  await user.click(screen.getByTestId("atom-preview-submit"));
}

describe("AtomPreviewPage (item-content T9)", () => {
  it("posts the pasted definition verbatim and renders all three cards", async () => {
    const fetchMock = okFetch(PREVIEW_OK);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<AtomPreviewPage />);

    await paste(user, JSON.stringify(DEFINITION));

    await waitFor(() => expect(screen.getByTestId("atom-preview-result")).toBeInTheDocument());

    // The request: the author's own definition, unchanged, at the preview route.
    expect(fetchMock.mock.calls[0]![0]).toContain("/api/items/preview/card");
    expect(fetchMock.mock.calls[0]![1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual(DEFINITION);

    for (const mode of ["rolled", "min", "max"])
      expect(screen.getByTestId(`atom-preview-card-${mode}`)).toBeInTheDocument();
  });

  it("shows the same family at both ends of its authored range", async () => {
    vi.stubGlobal("fetch", okFetch(PREVIEW_OK));
    const user = userEvent.setup();
    renderWithProviders(<AtomPreviewPage />);

    await paste(user, JSON.stringify(DEFINITION));
    await waitFor(() => expect(screen.getByTestId("atom-preview-result")).toBeInTheDocument());

    // The renderer's own sentences, read straight off the cards — the band, then each end of it.
    expect(screen.getByTestId("atom-preview-card-rolled")).toHaveTextContent("+19–37 attack");
    expect(screen.getByTestId("atom-preview-card-min")).toHaveTextContent("+19 attack");
    expect(screen.getByTestId("atom-preview-card-max")).toHaveTextContent("+37 attack");

    // And the depth the render actually used, from the response rather than a default typed here.
    expect(screen.getByTestId("atom-preview-meta")).toHaveTextContent("Θ_content 20");
  });

  it("shows the server's own named refusal rather than an empty card", async () => {
    vi.stubGlobal(
      "fetch",
      refusingFetch("item.display-template-missing: 'atom.fx-passive-atk-flat' has no display template row")
    );
    const user = userEvent.setup();
    renderWithProviders(<AtomPreviewPage />);

    await paste(user, JSON.stringify(DEFINITION));

    await waitFor(() =>
      expect(screen.getByTestId("atom-preview-error")).toHaveTextContent("item.display-template-missing")
    );
    expect(screen.queryByTestId("atom-preview-result")).not.toBeInTheDocument();
  });

  it("refuses malformed JSON in the browser rather than posting it", async () => {
    const fetchMock = okFetch(PREVIEW_OK);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<AtomPreviewPage />);

    await paste(user, "{ not json");

    expect(screen.getByTestId("atom-preview-parse-error")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
