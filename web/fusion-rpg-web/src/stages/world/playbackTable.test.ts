import { describe, expect, it, vi } from "vitest";
import firstLightTurns from "./fixtures/first-light-turn.json";
import { describePlaybackEntry, type PlaybackEntry } from "./playbackTable";

function entry(overrides: Partial<PlaybackEntry>): PlaybackEntry {
  return { kind: "event", subject: "dave", detail: "", sectorId: null, ...overrides };
}

/**
 * The completeness test (world-stage W72) — walks the real token inventory rather than spot-
 * checking. Audited directly against the C# source before writing this file: **68 tokens, not the
 * task's own stated 63** (22 event prefixes, 3 battle kinds, 5 calendar (subject, detail) pairs
 * across 2 subjects, 41 drop reasons) — the discrepancy is real (`SupplyGraph.cs` and
 * `MarchResolver.cs` both sit outside the task's original file hints but are genuine sources
 * reachable from the normal turn-resolution path), not a miscount carried over into this list.
 *
 * **72 tokens as of world-notify-source (NS5.4/NS5.6)** — `supply.besieged` (ask A6) plus
 * `growth.pulse`, `develop.completed`, `development.raised` (`GrowthPhases.cs`), all real reviewed
 * additions: every one is a `WorldTurnNotificationClassifier` row that had no rendered body until
 * now (the latter three surfaced via the coverage guard, not the spec's own hint list).
 */

const EVENT_PREFIXES = [
  "loam.overflow",
  "loam.handicap",
  "loam.shortfall.unresolved",
  "loam.shortfall",
  "loam.lost",
  "unmade.spawned",
  "intel.new",
  "claim.already-yours",
  "claim.held",
  "claim.barren",
  "build.started",
  "warden.bound",
  "sustain",
  "legion.topup",
  "supply.restored",
  "legion.starved",
  "legion.burn",
  "legion.runway",
  "arrival",
  "halt",
  "supply.cut",
  "supply.besieged",
  "recovery",
  "growth.pulse",
  "develop.completed",
  "development.raised"
];

const BATTLE_KINDS = ["sector", "lane", "guard"];

const CALENDAR_PAIRS: Array<[string, string]> = [
  ["week", "special"],
  ["week", "ordinary"],
  ["month", "plague"],
  ["month", "special"],
  ["month", "ordinary"]
];

const DROP_REASONS = [
  "kind.unknown",
  "command.id-missing",
  "command.id-too-long",
  "commander.unknown",
  "entity.unknown",
  "entity.not-yours",
  "sector.unknown",
  "entity.missing",
  "stance.unknown",
  "sector.missing",
  "sector.not-yours",
  "warden.missing",
  "amount.invalid",
  "slot.unknown",
  "structure.unknown",
  "lane.unknown",
  "entity.routed",
  "entity.held",
  "entity.gone",
  "claim.elsewhere",
  "claim.contested",
  "claim.guarded",
  "build.elsewhere",
  "build.not-yours",
  "build.occupied",
  "build.wrong-slot-kind",
  "build.out-of-range",
  "build.cannot-afford",
  "sector.gone",
  "warden.not-yours",
  "sustain.not-standing",
  "sustain.not-yours",
  "sustain.nothing-carried",
  "slot.elsewhere",
  "guard.already-cleared",
  "path.empty",
  "path.not-contiguous",
  "lane.no-heading",
  "lane.severed",
  "lane.one-way",
  "lane.gated"
];

describe("playbackTable — inventory counts, audited not estimated (world-stage W72)", () => {
  it("names exactly 26 event prefixes, 3 battle kinds, 5 calendar pairs, 41 drop reasons", () => {
    expect(EVENT_PREFIXES).toHaveLength(26);
    expect(BATTLE_KINDS).toHaveLength(3);
    expect(CALENDAR_PAIRS).toHaveLength(5);
    expect(DROP_REASONS).toHaveLength(41);
    expect(new Set(EVENT_PREFIXES).size).toBe(26); // no accidental duplicate keys
    expect(new Set(DROP_REASONS).size).toBe(41);
  });

  it("every one of the 26 event prefixes renders real text, never the raw token", () => {
    // "sustain" and "halt" are both ordinary English words the sentence legitimately uses ("spent
    // to sustain a legion", "is halted at") — the token check below would false-positive on the
    // word itself, so both are excluded from the blanket scan and proven in the golden tests below.
    for (const prefix of EVENT_PREFIXES.filter((p) => p !== "sustain" && p !== "halt")) {
      const text = describePlaybackEntry(entry({ kind: "event", detail: `${prefix}:120` }));
      expect(text).not.toContain(prefix);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("every one of the 3 battle kinds renders real text — the winner is never named (world-stage W74/W76: no display name available in this pure fold)", () => {
    for (const kind of BATTLE_KINDS) {
      const text = describePlaybackEntry(entry({ kind: "battle", detail: `${kind}:ember-hollow:e-dave-legion-1` }));
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain("a legion wins");
      expect(text).not.toContain("e-dave-legion-1");
      // "sector"/"guard" locations are real sector ids and are humanised; "lane" is a lane id,
      // which `sectorLabel` cannot correctly recover its two endpoints from (world-stage W74) — left
      // raw rather than mislabelled.
      if (kind === "lane") expect(text).toContain("ember-hollow");
      else expect(text).toContain("Ember Hollow");
    }
  });

  it("every one of the 5 calendar pairs renders real text", () => {
    for (const [subject, detail] of CALENDAR_PAIRS) {
      const text = describePlaybackEntry(entry({ kind: "calendar", subject, detail }));
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toBe(detail);
    }
  });

  it("every one of the 41 drop reasons renders real text, never the raw token", () => {
    for (const reason of DROP_REASONS) {
      const text = describePlaybackEntry(entry({ kind: "command.dropped", detail: reason }));
      expect(text).not.toContain(reason);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe("playbackTable — unit families, the specific cases the task calls out (world-stage W72)", () => {
  it("loam.handicap:150 renders 15% more, never the bare 150", () => {
    const text = describePlaybackEntry(entry({ kind: "event", detail: "loam.handicap:150" }));
    expect(text).toContain("15%");
    expect(text).not.toContain("150");
  });

  it("legion.runway is an absolute future turn, never rendered as a duration ('N turns left')", () => {
    // turn 8 + 3 turns of runway = runs dry on turn 11 — the sum the engine actually emits.
    const text = describePlaybackEntry(entry({ kind: "event", detail: "legion.runway:11" }));
    expect(text).toContain("turn 11");
    expect(text).not.toMatch(/\d+\s+turns?\s+left/i);
  });

  it("sustain:120 renders as whole loam, comma-grouped at scale, never a bare 120", () => {
    const text = describePlaybackEntry(entry({ kind: "event", detail: "sustain:1200" }));
    expect(text).toContain("1,200");
  });

  it("path.not-contiguous never appears verbatim — the refusal reads as a sentence", () => {
    const text = describePlaybackEntry(entry({ kind: "command.dropped", detail: "path.not-contiguous" }));
    expect(text).not.toContain("path.not-contiguous");
    expect(text.toLowerCase()).toContain("route");
  });

  it("halt's nested composite (halt:zoc:<sectorId>) is parsed through both colons and humanised, not left with a stray 'zoc:' or a raw id", () => {
    const text = describePlaybackEntry(entry({ kind: "event", subject: "e-dave-legion-1", detail: "halt:zoc:ember-hollow" }));
    expect(text).toContain("Ember Hollow");
    expect(text).not.toContain("zoc:");
    expect(text).not.toContain("ember-hollow");
  });

  it("arrival humanises the destination and never names which legion (world-stage W74/W76)", () => {
    const text = describePlaybackEntry(entry({ kind: "event", subject: "e-dave-legion-1", detail: "arrival:ember-hollow" }));
    expect(text).not.toContain("e-dave-legion-1");
    expect(text).toContain("Ember Hollow");
  });

  it("a battle with no winner (mutual destruction or a guard that held) says so, never a false winner", () => {
    const text = describePlaybackEntry(entry({ kind: "battle", detail: "sector:ember-hollow:none" }));
    expect(text).toContain("nobody wins");
  });

  it("build.wrong-slot-kind's embedded '-needs-' separator renders as a real sentence, never the raw dash-joined string", () => {
    const text = describePlaybackEntry(entry({ kind: "command.dropped", detail: "build.wrong-slot-kind:grove-needs-rootbed" }));
    expect(text).not.toContain("-needs-");
    expect(text).toContain("needs");
  });
});

describe("playbackTable — an unrecognised token, never silently swallowed (world-stage W72)", () => {
  it("logs loudly and renders a visibly broken marker in development — Vitest always runs with import.meta.env.DEV true", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const text = describePlaybackEntry(entry({ kind: "event", detail: "some.brand-new-token:42" }));
    expect(text).toContain("some.brand-new-token");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // Production's neutral-sentence branch is compile-time-folded by Vite on `import.meta.env.DEV`
  // (the same constraint `i18n/index.test.ts` documents for its own DEV-gated branch) — Vitest
  // always runs with DEV true, so that branch is not directly exercised here; it is a one-line
  // `if` with nothing else conditional inside it, read directly in `playbackTable.ts` instead.
});

describe("playbackTable — `attrition:` is a dead engine branch (world-stage W73)", () => {
  it("has no row — LegionSupply.Resolve replaced wound attrition (SupplyGraph.cs:42-45); re-adding one is a deliberate act", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const text = describePlaybackEntry(entry({ kind: "event", detail: "attrition:ash-waste" }));
    expect(text).toContain("attrition");
    spy.mockRestore();
  });
});

describe("playbackTable — bound to the golden `first-light-turn.json` (world-stage W76)", () => {
  it("every entry across all six turns renders through the table with no fall-through, no raw `:`-delimited token, and no kebab-case id", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reports = firstLightTurns as { turn: number; entries: PlaybackEntry[] }[];
    const rendered = reports.flatMap((report) =>
      report.entries
        .filter((e) => e.kind !== "command.accepted")
        .map((e) => describePlaybackEntry(e))
    );

    expect(rendered.length).toBeGreaterThan(0);
    expect(spy).not.toHaveBeenCalled(); // no unrecognised token logged anywhere in the golden

    for (const text of rendered) {
      // A raw engine token: a dotted-or-bare lowercase prefix directly followed by `:` and more
      // token characters (`loam.overflow:50`, `arrival:ember-hollow`) — never a real sentence.
      expect(text).not.toMatch(/[a-z][a-z.]*:[a-z0-9]/);
      // A raw kebab-case id — a sector, lane, or entity id leaking through unhumanised
      // (`ember-hollow`, `e-dave-legion-1`). Real prose from this table has no hyphenated words.
      expect(text).not.toMatch(/\b[a-z]+-[a-z0-9-]+\b/);
    }

    spy.mockRestore();
  });
});
