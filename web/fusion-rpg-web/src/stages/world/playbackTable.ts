import type { Magnitude } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { sectorLabel } from "./labels";

/**
 * The one translation table (world-stage W72). `classify()` used to recognise five prefixes and
 * print the raw string on everything else (`turnPlayback.ts`'s old `classify`/`describe`), so a
 * turn in which the empire starved read literally `dave loam.shortfall:340` and a refused order
 * read `t3-move-e-dave-legion-1 dropped — path.not-contiguous`. **It is one table, not per-prefix
 * handling** — per-prefix handling is precisely how the 5-of-21 state arose.
 *
 * **The real inventory was 68 tokens, not the task's own stated 63** — audited directly against the
 * C# source (not estimated) before writing any row, and the discrepancy was real, not a miscount
 * carried over: 22 event prefixes (not 21 — `supply.cut`/`recovery` live in `SupplyGraph.cs`, a
 * file outside the task's own original hint list) and 41 drop reasons (not 37 — most of the gap is
 * `MarchResolver.cs`'s 7 tokens, also outside the hint list, reached only via
 * `MovementPhase.cs:48`, plus several resolver-level reasons beyond `WorldCommandAdmission.cs`
 * alone). Battle kinds (3) and calendar subjects (2) matched exactly. Every token below is cited to
 * its real file:line.
 *
 * **72 tokens as of world-notify-source (NS5.4/NS5.6)** — four more event prefixes than the
 * previous count: `supply.besieged` (ask A6, `SupplyGraph.cs:113-114`), and `growth.pulse`,
 * `develop.completed`, `development.raised` (`GrowthPhases.cs:65,132,141`) — all four were classifier
 * rows (`WorldTurnNotificationClassifier`) with no rendered body until now; the coverage guard
 * (`notify-format`'s `coverageGuard.test.ts`) is what caught the latter three, since the spec's own
 * hint list named only `supply.besieged` as missing.
 */

export type PlaybackEntry = {
  kind: string;
  subject: string;
  detail: string;
  sectorId: string | null;
};

const loam = (value: number): Magnitude => ({ unit: "loamUnits", value });
const percentFlat = (value: number): Magnitude => ({ unit: "perMilleRatio", op: "flat", value });
const count = (value: number): Magnitude => ({ unit: "count", value });

/** The text after the *first* colon only — several details (`halt:zoc:X`) nest a second colon in
 * their own argument, and splitting on every colon would shred it. */
function afterFirstColon(detail: string): string | null {
  const i = detail.indexOf(":");
  if (i < 0) return null;
  const tail = detail.slice(i + 1).trim();
  return tail.length > 0 ? tail : null;
}

function prefixOf(detail: string): string {
  const i = detail.indexOf(":");
  return i < 0 ? detail : detail.slice(0, i);
}

function toNumber(arg: string | null): number {
  const n = Number(arg);
  return Number.isFinite(n) ? n : 0;
}

// ===========================================================================
// Event prefixes (26) — Kind === "event". `TurnReportKinds.Event`.
// ===========================================================================

type EventRow = (arg: string | null, entry: PlaybackEntry) => string;

const EVENT_TABLE: Record<string, EventRow> = {
  // LoamPhases.cs
  "loam.overflow": (arg) => `Loam capacity overflowed by ${formatMagnitude(loam(toNumber(arg)))}.`,
  "loam.handicap": (arg) => `${formatMagnitude(percentFlat(toNumber(arg)))} more upkeep here.`,
  "loam.shortfall.unresolved": (arg) =>
    `A loam shortfall of ${formatMagnitude(loam(toNumber(arg)))} has nowhere to fall back to.`,
  "loam.shortfall": (arg) => `A loam shortfall of ${formatMagnitude(loam(toNumber(arg)))} hit this turn.`,
  "loam.lost": (arg) => `${arg ? sectorLabel(arg) : "This ground"} is lost.`,
  "unmade.spawned": (arg) => `An unmade stirs at ${arg ? sectorLabel(arg) : "the frontier"}.`,
  // TurnEngine.cs
  "intel.new": (arg) => `${formatMagnitude(count(toNumber(arg)))} newly-seen sectors this turn.`,
  // ClaimResolver.cs — arg is always a `sector.SectorId` (`ClaimResolver.cs:56,91,98`), never a lane.
  "claim.already-yours": (arg) => `${arg ? sectorLabel(arg) : "This ground"} was already yours.`,
  "claim.held": (arg) => `${arg ? sectorLabel(arg) : "This ground"} changes hands.`,
  "claim.barren": (arg) => `${arg ? sectorLabel(arg) : "This ground"} holds no source at all.`,
  // BuildResolver.cs
  "build.started": (arg) => `Construction begins on ${arg ?? "a structure"}.`,
  // GrowthPhases.cs:65 — a weekly RecruitStock gain, always a sector (arg is the raw pulse amount).
  // world-notify-source NS5.6: discovered missing by the coverage guard while wiring the classifier
  // (the spec's own hint list named only `supply.besieged` as new; these three were also absent).
  // Wording avoids the bare word "growth" — the catalog category id IS that word, and the coverage
  // guard's raw-token check would otherwise false-positive on it (the same reason `sustain`/`halt`
  // are excluded from this file's own blanket token scan below).
  "growth.pulse": (arg, entry) =>
    `${entry.sectorId ? sectorLabel(entry.sectorId) : "This ground"} gains ${formatMagnitude(count(toNumber(arg)))} recruits this week.`,
  // GrowthPhases.cs:132 — arg is a raw ProjectCatalog id, left un-humanised (matches `build.started`'s
  // own precedent for a catalog id inside a sentence, `playbackTable.ts:78`).
  "develop.completed": (arg, entry) =>
    `${entry.sectorId ? sectorLabel(entry.sectorId) : "A sector"} completes ${arg ?? "a project"}.`,
  // GrowthPhases.cs:141 — arg is DevelopmentLevel's own integer bonus, always a sector.
  "development.raised": (arg, entry) =>
    `${entry.sectorId ? sectorLabel(entry.sectorId) : "This ground"}'s development rises by ${formatMagnitude(count(toNumber(arg)))}.`,
  // WardenResolver.cs
  "warden.bound": (arg) => `A warden is bound here${arg ? ` (${arg})` : ""}.`,
  // SustainResolver.cs — bare word, no dot, unlike every other event prefix.
  sustain: (arg) => `${formatMagnitude(loam(toNumber(arg)))} spent to sustain a legion.`,
  // LegionSupply.cs
  "legion.topup": (arg) => `A legion draws ${formatMagnitude(loam(toNumber(arg)))} in supply.`,
  "supply.restored": () => "Supply is restored.",
  "legion.starved": (arg) =>
    arg ? `A legion starves at ${arg}.` : "A legion starves.",
  "legion.burn": (arg) => `A legion burns ${formatMagnitude(loam(toNumber(arg)))} a turn.`,
  // MovementPhase.cs — `runway`'s argument is an ABSOLUTE future turn index (current turn +
  // turns-until-exhausted), never a duration — rendering it as "N turns left" would be wrong.
  "legion.runway": (arg) => `A legion runs dry on turn ${arg ?? "?"}.`,
  // `arg` is `ArrivedAtSectorId ?? OnLaneId` (`MovementPhase.cs:126`) — usually a sector, but a
  // legion that ends its march mid-lane arrives at a lane instead (its own documented edge case,
  // "fog defect B", `MovementPhase.cs:197-200`); `sectorLabel` still title-cases a lane id without
  // misinforming which lane it is, just less prettily. `entry.subject` is never named (world-stage
  // W74: a legion's display name cannot be derived from its id, and this pure fold has no lookup to
  // supply a real one) — "a legion", matching `sustain`/`legion.burn`'s own existing convention,
  // rather than printing the raw `e-dave-legion-1`.
  arrival: (arg) => `A legion reaches ${arg ? sectorLabel(arg) : "the lane"}.`,
  // Detail is the nested composite `halt:zoc:<sectorId>` — `afterFirstColon` only strips the outer
  // `halt:`, leaving `zoc:<sectorId>`, so this row strips the inner `zoc:` itself. Always a sector
  // (`MovementPhase.cs:131`, `"zoc:" + outcome.AtSectorId`), never a lane.
  halt: (arg) => {
    const sectorId = (arg ?? "").replace(/^zoc:/, "");
    return `A legion is halted at ${sectorId ? sectorLabel(sectorId) : "the frontier"}.`;
  },
  // SupplyGraph.cs — outside the task's own hint list; found by reading the file directly. Always a
  // sector (`SupplyGraph.cs:58`).
  "supply.cut": (arg) => `${arg ? sectorLabel(arg) : "This ground"} is cut off.`,
  // world-notify-source ask A6 — SupplyGraph.cs:113-114, always a sector. A warning shown before the
  // cut itself: distinct wording from `supply.cut` above so the two are never confused mid-turn.
  "supply.besieged": (arg) => `${arg ? sectorLabel(arg) : "This ground"} is besieged — supply may be cut next turn.`,
  recovery: (arg) => (arg ? `Supply reaches a legion at ${arg}.` : "A legion's supply is restored.")
};

function describeEvent(entry: PlaybackEntry): string | null {
  const prefix = prefixOf(entry.detail);
  const row = EVENT_TABLE[prefix];
  if (!row) return null;
  return row(afterFirstColon(entry.detail), entry);
}

// ===========================================================================
// Battle kinds (3) — Kind === "battle". Detail is `<kind>:<locationId>:<winner-or-"none">`.
// ===========================================================================

const BATTLE_PLACE_WORD: Record<string, string> = {
  sector: "sector",
  lane: "lane",
  guard: "guard"
};

function describeBattle(entry: PlaybackEntry): string | null {
  const parts = entry.detail.split(":");
  if (parts.length < 3) return null;
  const [battleKind, location, winner] = parts;
  const placeWord = BATTLE_PLACE_WORD[battleKind];
  if (!placeWord) return null;
  const article = placeWord === "guard" ? "A guard battle" : `A ${placeWord} battle`;
  // `location` is a sector id for "sector"/"guard" (confirmed against the golden fixture and
  // `BattleSeam.cs`); only "lane" carries a lane id, which `sectorLabel` cannot correctly recover
  // its endpoints from (world-stage W74) — left raw rather than mislabelled.
  const place = battleKind === "lane" ? location : sectorLabel(location);
  // `winner` is an entity id, never named here for the same reason `arrival`/`halt` don't (W74: no
  // real display name available in this pure fold) — "a legion wins" rather than the raw id.
  return winner && winner !== "none"
    ? `${article} at ${place} — a legion wins.`
    : `${article} at ${place} — nobody wins.`;
}

// ===========================================================================
// Calendar subjects (2) — Kind === "calendar". Subject is "week"/"month"; Detail is a bare word,
// never a `prefix:arg` pair, so this is keyed on the (subject, detail) pair, not a prefix.
// ===========================================================================

const CALENDAR_TABLE: Record<string, string> = {
  "week:special": "A special week begins.",
  "week:ordinary": "An ordinary week begins.",
  "month:plague": "A plague month begins.",
  "month:special": "A special month begins.",
  "month:ordinary": "An ordinary month begins."
};

function describeCalendar(entry: PlaybackEntry): string | null {
  return CALENDAR_TABLE[`${entry.subject}:${entry.detail}`] ?? null;
}

// ===========================================================================
// Drop reasons (41) — Kind === "command.dropped". Bare enum-like strings, mostly no argument.
// Several file:file duplicates collapse to one row (the wire cannot tell them apart, and neither
// does the player need it to) — `entity.gone`, `entity.routed`, `slot.unknown`, `structure.unknown`,
// `lane.unknown` each fire from more than one resolver but mean the same thing to a viewer.
//
// **Deliberately NOT the registry for party-dungeon D1.28's `delve.none-discovered`** (checked before
// adding it here, then reverted): `DROP_REASONS` (this table's own keys) is also
// `blockedPlacement.ts`'s complete, closed enumeration of where a blocked MARCH renders on the map
// canvas (road/sector/slot/marker) — `BlockedTarget.test.tsx` asserts every one of the 41 has a real
// placement. A delve-door availability reason has no march/placement meaning at all, so it stays out
// of this table; its `ActionCluster` row instead relies on `reasonFor.ts`'s own documented fallback
// (loud in dev, a neutral sentence in production) for a token this table was never meant to carry.
// ===========================================================================

type DropRow = (arg: string | null) => string;

const simple = (text: string): DropRow => () => text;

const DROP_TABLE: Record<string, DropRow> = {
  // WorldCommandAdmission.cs
  "kind.unknown": simple("Order refused — unrecognised command."),
  "command.id-missing": simple("Order refused — no command id."),
  "command.id-too-long": simple("Order refused — command id too long."),
  "commander.unknown": simple("Order refused — unknown commander."),
  "entity.unknown": simple("Order refused — that force is not known."),
  "entity.not-yours": simple("Order refused — that force is not yours."),
  "sector.unknown": simple("Order refused — that sector is not known."),
  "entity.missing": simple("Order refused — no force named."),
  "stance.unknown": simple("Order refused — unrecognised stance."),
  "sector.missing": simple("Order refused — no sector named."),
  "sector.not-yours": simple("Order refused — that sector is not yours."),
  "warden.missing": simple("Order refused — no warden named."),
  "amount.invalid": simple("Order refused — that amount is not valid."),
  "slot.unknown": simple("Order refused — that slot is not known."),
  "structure.unknown": simple("Order refused — unrecognised structure."),
  "lane.unknown": simple("Order refused — that lane is not known."),
  // TurnEngine.cs (inline)
  "entity.routed": simple("Order refused — that force is routed."),
  "entity.held": simple("Order refused — that force is holding, not marching."),
  // ClaimResolver.cs
  "entity.gone": simple("Order refused — that force is gone."),
  "claim.elsewhere": simple("Order refused — that force is elsewhere."),
  "claim.contested": simple("Order refused — the ground is contested."),
  "claim.guarded": (arg) => `Order refused — a guard still holds${arg ? ` slot ${arg}` : ""}.`,
  // BuildResolver.cs
  "build.elsewhere": simple("Order refused — that force is elsewhere."),
  "build.not-yours": simple("Order refused — that ground is not yours."),
  "build.occupied": (arg) => `Order refused — ${arg ?? "something"} already stands there.`,
  "build.wrong-slot-kind": (arg) => `Order refused — the wrong kind of ground${arg ? ` (${arg.replace("-needs-", ", needs ")})` : ""}.`,
  // Always a sector id (`BuildResolver.cs:97`, `"build.out-of-range:" + sector.SectorId`).
  "build.out-of-range": (arg) => `Order refused — ${arg ? sectorLabel(arg) : "that ground"} is out of range.`,
  "build.cannot-afford": simple("Order refused — cannot afford it."),
  // WardenResolver.cs
  "sector.gone": simple("Order refused — that sector is gone."),
  "warden.not-yours": simple("Order refused — that warden is not yours."),
  // SustainResolver.cs
  "sustain.not-standing": simple("Order refused — that force is not standing still."),
  "sustain.not-yours": simple("Order refused — that force is not yours."),
  "sustain.nothing-carried": simple("Order refused — nothing is being carried."),
  // SiegePhase.cs
  "slot.elsewhere": simple("Order refused — that slot is elsewhere."),
  "guard.already-cleared": simple("Order refused — the guard is already cleared."),
  // MarchResolver.cs — outside the task's own hint list; found by reading the file directly.
  "path.empty": simple("Order refused — no route given."),
  "path.not-contiguous": simple("Order refused — the route does not continue from where it stands."),
  "lane.no-heading": simple("Order refused — that lane has no heading."),
  "lane.severed": simple("Order refused — that lane is severed."),
  "lane.one-way": simple("Order refused — that lane runs one way only."),
  "lane.gated": simple("Order refused — that lane is gated.")
};

function describeDrop(entry: PlaybackEntry): string | null {
  const prefix = prefixOf(entry.detail);
  const row = DROP_TABLE[prefix];
  if (!row) return null;
  return row(afterFirstColon(entry.detail));
}

/**
 * The one entry point. Returns `null` only for a genuinely unrecognised token — every real one of
 * the 68 audited above resolves to real text. An unrecognised token is a real defect (a new engine
 * string this table was never updated for), never silently swallowed: it renders a visibly broken
 * marker and logs loudly in development, and degrades to one neutral sentence in production —
 * never the raw token either way.
 */
export function describePlaybackEntry(entry: PlaybackEntry): string {
  const known =
    entry.kind === "event"
      ? describeEvent(entry)
      : entry.kind === "battle"
        ? describeBattle(entry)
        : entry.kind === "calendar"
          ? describeCalendar(entry)
          : entry.kind === "command.dropped"
            ? describeDrop(entry)
            : null;

  if (known != null) return known;

  const token = `${entry.kind}:${entry.detail}`;
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(`playbackTable: unrecognised token ${token} — the table was not updated for it.`);
    return `⚠ unrecognised turn-report token: ${token}`;
  }
  return "Something happened this turn.";
}
