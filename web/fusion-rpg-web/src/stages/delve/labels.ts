import type { DomainOfferView, ExtractionView, RoomView } from "@/contract/types";

/**
 * D5.10 (spec-delve-stage.md §8) — the delve program's one id → message table. "Vocabulary travels
 * as an id and is translated by `src/stages/delve/labels.ts` … there is no second registry to keep
 * in step" (§8, verbatim). Shaped like `stages/world/labels.ts`: several small, pure, total
 * functions — one per closed vocabulary — rather than one giant object literal, so each stays
 * independently readable and each unknown-id fallback sits next to its own reasoning.
 *
 * **Plain strings, not Lingui `msg` descriptors — a deliberate, named choice, not an oversight.**
 * §8's own text says these messages "live in `src/i18n/locales/en/messages.po` (Lingui
 * `msg`/`Trans`)", but the one real sibling this task was told to mirror — `stages/world/labels.ts`
 * — is plain, un-internationalized TypeScript (confirmed by reading it in full: no `@lingui/macro`
 * import anywhere in it), and no non-JSX `.ts` file anywhere in this tree yet builds an id→`msg`
 * lookup table (the only hit for `@lingui/macro` outside a `.tsx` file is `i18n/reactivityGuard.ts`,
 * a scanner that looks for `msg`/`Trans` call sites, not a label source itself — confirmed by grep).
 * Built plain, matching the real, existing convention this task was told to follow rather than a
 * spec sentence no shipped code yet demonstrates. Out of v1 anyway (§11: "no second locale … of any
 * kind" for this whole module) — the Lingui migration is a real, open, named gap for whichever task
 * first needs a second delve locale, not decided here.
 *
 * **Folded in from `graph/roomKindLabels.ts`'s own pull-forward, per that file's own header note**
 * ("this table's eleven room-kind rows plus four banner rows are the literal content D5.10 should
 * fold in, not re-author") — `roomKindLabel` and `partyBannerLabel` below carry the identical id set
 * and identical wording that file already established (independently re-derived here from the same
 * spec citations before this file was cross-checked against it, and found byte-for-byte identical).
 * **Two fallback arms deliberately differ, named precisely rather than silently matched:**
 * `graph/roomKindLabels.ts`'s own `roomKindLabel` falls back to the raw wire id for an unrecognised
 * kind (`ROOM_KIND_LABELS[kind] ?? kind`) and its own `partyBannerLabel` falls back to a bare ordinal
 * for an out-of-range index (`` `Banner ${partyIndex + 1}` ``) — both explicitly reasoned there as
 * "never crash the graph," and both currently unreachable (`RoomKindCatalog` is a closed,
 * load-validated 11-member enum; `raidMode` tops out at `quad`, four parties). But an engine id or a
 * bare ordinal reaching player text is exactly what GG-23 (§8) and D5.6's own
 * `Party_labels_are_names_not_indices` forbid if either vocabulary ever grows without both files
 * updating together — this module's own fallbacks below never leak either shape. `graph/` is this
 * session's explicitly out-of-bounds concurrent work (D5.4, mid-build) and is not edited here; this
 * is named for whoever consolidates the two callers onto this file's exports.
 *
 * Every function below is closed and total over a small, catalog-validated vocabulary
 * (`RaidModeCatalog`/`raid-modes.v1.json`, `RoomKindCatalog`/`room-kinds.v1.json`,
 * `NervePolicy`/`bands.v1.json`'s `nerveStage` band, `DomainOffers.EntryKeyStanding`/
 * `EntryKeySingleDescent`) — every id set below was read directly from the working tree, not taken
 * from the spec's prose alone. None of these throws: an id outside the known set is a real
 * version-skew defect, not a normal "still loading" gap, so each function falls back to a named,
 * safe member instead of crashing or leaking the wire token — the same shape `contract/adapt.ts`'s
 * own `toDomainEntryKey` already established for exactly this situation ("an unrecognised wire value
 * falls back to the more permissive reading").
 */

/**
 * `PartyView.partyIndex` — never rendered raw (§8: "`PartyIndex` … never rendered"; D5.6's own
 * `Party_labels_are_names_not_indices`, "no rendered string carries a bare ordinal"). Four fixed
 * names, ask 13's own framing: "no sibling owns them … Owned here, in `labels.ts`." Matches
 * `graph/roomKindLabels.ts`'s own `PARTY_BANNER_NAMES` content exactly.
 */
const BANNER_NAMES: readonly string[] = ["First Banner", "Second Banner", "Third Banner", "Fourth Banner"];

/** Today's raid modes cap at `quad` (four parties, `raid-modes.v1.json`), so every legal index is
 * 0..3. An index outside that range is a real defect — the fallback is a name, never a bare ordinal,
 * unlike `graph/roomKindLabels.ts`'s own same-purpose function (see this module's header). */
export function partyBannerLabel(partyIndex: number): string {
  return BANNER_NAMES[partyIndex] ?? "Unnamed Banner";
}

/**
 * `DomainOfferView.entryKey` (`contract/types.ts:1328`) — already narrowed away from the engine's
 * own `entry: "once" | "many"` at `adapt.ts`'s `toDomainEntryKey` (`DomainOffers.cs:97`'s own
 * `EntryKeySingleDescent`/`EntryKeyStanding` constants), so this function never receives the raw
 * wire word — §8's row is read as "the already-adapted client id `entryKey` renders as a phrase,"
 * not as a second `once`/`many` translation this module would need to duplicate.
 *
 * Wording is §8's own literal prose (`spec-delve-stage.md:169`: "*One descent only* · *Open
 * ground*"), not `bands.v1.json`'s differently-keyed, differently-worded `entry` band
 * (`gk-data/packs/fusion/data/seed/dungeon/_registry/bands.v1.json`: `once`→"Single Descent", `many`→"Open Ground") —
 * that registry is seed-content authoring/validation vocabulary, keyed by the pre-adapter engine
 * ids the web client never receives; nothing under `web/` reads any `_registry/*.json` file
 * (confirmed by grep), so it has no read path here to begin with.
 *
 * This is `Entry_kind_renders_as_a_phrase_never_the_enum`'s own subject (`labels.test.ts`).
 */
export function entryKindLabel(entryKey: DomainOfferView["entryKey"]): string {
  return entryKey === "single-descent" ? "One descent only" : "Open ground";
}

/**
 * `DomainOfferView.raidModes[]` members — `RaidModeCatalog`'s own closed three
 * (`Dungeon/Registry/RaidModeCatalog.cs:3`: "solo · pair · quad"; `raid-modes.v1.json` carries no
 * display name of its own, confirmed by reading it, so this function is the sole real source —
 * ask 13's "no sibling owns them" framing, for the identical reason). Wording is §8's own literal
 * prose (`spec-delve-stage.md:169`). An unrecognised id falls back to the narrowest reading, `solo`'s
 * own phrase — never a party count guessed from nothing.
 */
export function raidModeLabel(raidMode: string): string {
  switch (raidMode) {
    case "pair":
      return "Two bands";
    case "quad":
      return "Four bands";
    case "solo":
    default:
      return "One band";
  }
}

/**
 * `MemberView.nerveStage` — `NervePolicy`'s own registry members in threshold order
 * (`Delve/Attrition/NervePolicy.cs:43`: "unsettled, shaken, afflicted"), matching `bands.v1.json`'s
 * real `nerveStage` band both in id set and in wording (`unsettled`→"Unsettled", `shaken`→"Shaken",
 * `afflicted`→"Afflicted") — identical to §8's own literal prose (`spec-delve-stage.md:171`), so no
 * rewording judgment call was needed here. An unrecognised id falls back to the mildest real stage —
 * never invents a worse one than the server actually reported.
 */
export function nerveStageLabel(nerveStage: string): string {
  switch (nerveStage) {
    case "shaken":
      return "Shaken";
    case "afflicted":
      return "Afflicted";
    case "unsettled":
    default:
      return "Unsettled";
  }
}

/**
 * D5.9 (`summary/ExtractionSummary.tsx`) — `ExtractionView.members[].outcome`. This module's own
 * closing note below used to name this as a real, deliberately unresolved mismatch ("whichever task
 * next touches `ExtractionView`"); that task is this one. The real producer is
 * `SettlementOutcome` (`Delve/Attrition/ExtractionSettlement.cs:7`) — three members, `Roster` /
 * `Recover` / `Retire` — not the five-way `Downed`/`Recovering(n)`/`Retired`/`won`/`Retreated` split
 * §8 row 6's own prose describes (that prose was written before the shipped enum was checked; `won`
 * is a separate real `boolean` on the same settlement, not a fourth outcome member, and this function
 * deliberately does not take it — the caller renders it on its own, the same "figure/flag rendered by
 * the caller, phrase built here" split `recoverDelves` already keeps, one paragraph down).
 *
 * `Retire` is the one that matters most: `ExtractionSettlement.cs`'s own doc comment calls it "which
 * roster row a member's `CloseDelve(Extracted)` settlement writes" for the permanent-loss case —
 * `BANNED_WORDS` above already bans the literal word "Retired" for exactly this reason (D5.10), so
 * this returns "Fallen" for it, never the wire word, matching §8's own mandated phrase ("never
 * retired"). `Roster` (the member was never downed at all this raid — confirmed against
 * `ExtractionSettlement.Decide`'s own `!downedOnce` branch) has no literal wording anywhere in §8's
 * table; "Unharmed" is this function's own plain, short, badge-shaped reading, matching the
 * one-or-two-word register `Down`/`Shaken`/`Afflicted`/`Fallen` already share, not lifted from any
 * doc. `recoverDelves` (a separate `Magnitude`, meaningful only when `outcome === "Recover"` per that
 * record's own doc comment — zero for the other two) is rendered by the caller via `formatMagnitude`,
 * not folded into this string. An unrecognised outcome falls back to `Roster`'s own reading — the
 * least alarming real member, never a guess at a worse one — the same "narrowest real fallback" shape
 * every other function in this file already uses.
 */
export function extractionOutcomeLabel(outcome: ExtractionView["members"][number]["outcome"]): string {
  switch (outcome) {
    case "Retire":
      return "Fallen";
    case "Recover":
      return "Recovering";
    case "Roster":
    default:
      return "Unharmed";
  }
}

/**
 * `RoomView.kind` / `.resolvedKind` — the eleven real room-kind ids: `RoomTableBinding.cs`'s own
 * `NoTableKinds` set (`curio`/`shrine`/`trap`/`wild`/`rest`/`merchant`/`unknown`) plus
 * `fight`/`elite`/`cache`/`boss` (that same file's own doc comment one line up: "`fight`/`elite`/
 * `cache`/`boss` … all read `dungeon-room`"). `RoomKindCatalog`/`room-kinds.v1.json` carry no
 * display-name field at all (confirmed by reading `RoomKindDef`), so this function is the sole real
 * source — ask 13's own framing again. Wording is §8's own literal prose, in the same order
 * (`spec-delve-stage.md:174`). `null` covers a room whose kind is sight-gated away
 * (`RoomView.kind === null` at `sight: "None"`, per `RoomView`'s own doc comment) — never a phrase,
 * passed straight through so a caller can render nothing rather than a guess. An unrecognised
 * non-null id falls back to the same phrase the real `unknown` kind already uses ("this doesn't
 * currently render as anything more specific" is the honest reading, not a guess at what it might
 * be) — unlike `graph/roomKindLabels.ts`'s own same-purpose function (see this module's header).
 */
const ROOM_KIND_LABELS: Readonly<Record<string, string>> = {
  fight: "Fight",
  elite: "Elite",
  cache: "Cache",
  curio: "Curio",
  wild: "A stranger",
  shrine: "Shrine",
  rest: "Camp",
  merchant: "Trader",
  trap: "Trap",
  unknown: "Unclear",
  boss: "The lair"
};

export function roomKindLabel(kind: RoomView["kind"]): string | null {
  if (kind == null) return null;
  return ROOM_KIND_LABELS[kind] ?? ROOM_KIND_LABELS.unknown;
}

/**
 * `TalkView.offered` members (D5.7) — `WildVerb`'s own C# member names, matching `contract/adapt.ts`'s
 * own `WILD_VERBS` ordinal table (`TalkTree.cs:6-16`) exactly. No §8 row gives literal wording for
 * these — the same named gap this file's closing note already states for the six object-prompt verbs
 * below, for the identical reason (no consumer existed to check a guess against until `layers/TalkPanel
 * .tsx`). Plain, literal readings; nothing here compresses two verbs into one phrase or invents a
 * meaning `TalkTree.cs`'s own member name doesn't already carry. Falls back to `Leave`'s own phrase —
 * the narrowest, most passive real verb — for anything outside the known eight, the same "an
 * unrecognised id falls back to a named safe member" shape every other function in this file uses.
 */
const WILD_VERB_LABELS: Readonly<Record<string, string>> = {
  Flatter: "Flatter",
  Threaten: "Threaten",
  OfferSouls: "Offer souls",
  OfferSpirit: "Offer spirit",
  OfferSupply: "Offer supplies",
  OfferContract: "Offer a contract",
  Fight: "Fight",
  Leave: "Leave"
};

export function wildVerbLabel(verb: string): string {
  return WILD_VERB_LABELS[verb] ?? WILD_VERB_LABELS.Leave!;
}

/**
 * `ObjectPromptView.verbs` members (D5.7) — the six real, lowercase ids `VerbResolver.cs` itself
 * switches on (confirmed by reading it directly: `("open", ...)`, `("destroy", ...)`, `("disarm", ...)`,
 * `("loot", ...)`, `("pray", ...)`, `("garrison", ...)`), matching spec §7's own row, sourced from
 * `spec-dungeon-registries.md:78`. Falls back to a deliberately vague, safe phrase for an unrecognised
 * verb — never a guess at what a future verb *does*, matching this file's own established "never leak,
 * never invent a specific meaning for an out-of-band id" discipline.
 */
const OBJECT_VERB_LABELS: Readonly<Record<string, string>> = {
  open: "Open",
  disarm: "Disarm",
  pray: "Pray",
  loot: "Loot",
  destroy: "Destroy",
  garrison: "Garrison"
};

export function objectVerbLabel(verb: string): string {
  return OBJECT_VERB_LABELS[verb] ?? "Do something";
}

/**
 * `ObjectPromptView.kind` (D5.7) — `ObjectKind`'s own four C# members, confirmed against
 * `VerbResolver.cs`'s own pattern match (`ObjectKind.Obstacle`, `.Curio`, `.Structure`, `.Building`).
 * No §8 row names these either; plain nouns, each already an ordinary English word with no engine
 * flavour to translate away. Falls back to `Curio`'s own phrase — the plainest, least alarming of the
 * four — for an id outside the known set.
 */
const OBJECT_KIND_LABELS: Readonly<Record<string, string>> = {
  Curio: "Curio",
  Obstacle: "Obstacle",
  Building: "Building",
  Structure: "Structure"
};

export function objectKindLabel(kind: string): string {
  return OBJECT_KIND_LABELS[kind] ?? OBJECT_KIND_LABELS.Curio!;
}

/**
 * D5.8 (`layers/DelvePickerLayer.tsx`, `stages/delve/confirms/`) — §8 row 9 ("`delve.price-undesigned`;
 * `extract` / `retreat` → the rule id; the decision kinds") plus §10's whole refusal table: the rule ids
 * `POST /api/delve/start` can return in its `{ reason }` body (`DelveEndpoints.cs`'s own `Refusal`,
 * fed by `DelveStart.Run`'s six ordered refusal groups), translated to the sentence the Descend confirm
 * shows when a real attempt is refused.
 *
 * Most of §10's table is rendered as a disabled control BEFORE a request is ever sent — refused rungs
 * are simply absent from `DomainOfferView.rungs` (never a client-side filter), a sealed or in-progress
 * row never offers Descend at all, an unavailable member's own row carries its reason — so this
 * function exists for the rows that can only be learned from the server's own answer:
 * `correlation.mismatch` (a genuine race, §10's own "only unpredictable member of step 1") and the
 * frozen-terms/seed-and-roll/one-transaction group (§10 rows 5-7, which the table itself says "reaches
 * the developer tree only" as a raw rule id — this is that translation, so a raw id never does). Every
 * reason id is read directly off `DelveEndpoints.cs`'s own `HandleStart`/`Refusal` and `DelveStart.Run`;
 * an id outside the known set falls back to the frozen-terms group's own sentence, since "the way did
 * not open" is honestly true of every refusal this function doesn't otherwise recognise — never a guess
 * at a more specific cause than the server actually gave.
 */
export function startRefusalMessage(reason: string): string {
  if (reason.startsWith("member.unavailable")) {
    return "One of the chosen creatures can't go on this delve right now.";
  }
  switch (reason) {
    case "domain.unknown":
    case "domain.stale":
    case "domain.not-found":
      return "That domain isn't open to you anymore.";
    case "domain.sealed":
      return "This domain is closed to you.";
    case "delve.in-progress":
      return "A delve is already under way there.";
    case "correlation.mismatch":
      return "That request already went through — refreshing.";
    case "rung.not-offered":
    case "raid.mode-not-offered":
    case "raid.party-shape":
      return "That choice isn't offered right now.";
    case "oath.implied":
      return "This descent requires accepting the Oath.";
    case "delve.souls-insufficient":
      return "You don't have enough souls for this.";
    case "delve.price-undesigned":
      return "Not for sale here.";
    default:
      return "The way did not open.";
  }
}

/**
 * **Named, not silently missing — every other §8 row, and why none is built here yet:**
 * - `bandName` / `rungId` / `tailPlus` (the difficulty-ladder rung names, §8 row 2; ask 3) — no real
 *   display-name producer is wired: `DelveEndpoints.cs:213`'s own `RungLabelFor` throws
 *   `NotImplementedException` unconditionally in production ("No rung display-name registry exists
 *   anywhere in this codebase"), confirmed by reading that call site directly. A label function here
 *   would have nothing real to translate yet — adding one would invite exactly the "adapter invents
 *   the missing value" defect `contract/types.ts`'s own module comment already names as a rule.
 * - Member status (`Downed` / `Recovering(n)` / `Retired` / `won` / `Retreated`, §8 row 6) — **built
 *   above, D5.9** (`extractionOutcomeLabel`): the real producer (`ExtractionSettlement.SettlementOutcome`)
 *   is `Roster` / `Recover` / `Retire`, not the five ids §8's prose names, and `won` is a separate real
 *   boolean field, not a fourth member of the same enum. Confirmed against both the C# enum
 *   (`Delve/Attrition/ExtractionSettlement.cs:7`) and this program's own already-written test fixtures
 *   (`contract/adaptDelve.test.ts:373-374`, `contract/delveViews.test.ts:166`, both feeding
 *   `outcome: "Roster"` / `"Recover"`). This bullet used to name the mismatch and defer the function to
 *   "whichever task next touches `ExtractionView`" — that task is `summary/ExtractionSummary.tsx`.
 * - Sight (`SectorSight`, §8 row 7) — deliberately not a word: "a drawn treatment," per §8's own
 *   text, and `graph/sightTreatment.ts` (D5.4) already keys off the raw `DelveSightState` value
 *   directly rather than rendering "Unlit"/"Glimpsed"/"Seen" anywhere.
 * - Door/lane state (`DelveDoorState`, `"Open" | "Severed"`) — never named as player-facing words
 *   anywhere in §8's table; left alone rather than inventing wording no spec section asks for.
 * - The six object-prompt verbs and the eight wild-talk verbs — **built above, D5.7** (`objectVerbLabel`
 *   / `wildVerbLabel` / `objectKindLabel`): `layers/ObjectPromptPanel.tsx` and `layers/TalkPanel.tsx`
 *   are the first real consumers to check a guess against, so this note's own former "left for D5.7/D5.8"
 *   deferral is closed for these three. The rule-id/decision-kind copy (§8 row 9, `delve.price-undesigned`
 *   and friends) — **built above, D5.8** (`startRefusalMessage`); the confirm-dialog copy generally
 *   (Descend/Extract/Retreat's own titles and messages) is built directly in
 *   `stages/delve/confirms/*.tsx` — none of it is id-shaped vocabulary (each confirm has exactly one
 *   fixed English title, never a variable enum with several values), so it does not belong in this
 *   file's own "one id → message table," matching the reasoning `railState.ts`'s own `UNLOCK_LADDER`
 *   already established for a fixed reason string that isn't itself a translated id.
 */
