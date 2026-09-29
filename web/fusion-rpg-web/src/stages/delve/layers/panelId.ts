/**
 * The six band-2 panel ids the `?panel=` query string carries (D5.7, spec-delve-stage.md §4/§7/§14).
 *
 * **Where the six literal ids come from — confirmed, not guessed.** §4's own examples give three
 * (`#/delve/8812?panel=pack`, `?panel=talk`, `?panel=fight`); the full six-value set appears in exactly
 * one place, §14's own testing-strategy row: `` `?panel={pack,talk,event,object,supply,fight}` ``
 * cold-loads stage-then-panel. Read here as the real, literal query values (the same backtick-quoted
 * literal convention §4's own three-item list already uses), not a shorthand — this task's own brief
 * flagged the ambiguity explicitly ("confirm... since the spec never states all six ids as a single
 * literal list in one place") and asked it be checked before hardcoding; §14 turned out to be exactly
 * that list. `object`, not `objectPrompt`: the short id is what travels on the wire (the URL); the
 * longer name (`ObjectPromptView`, `contract/types.ts`; "Object prompt", spec §7's own row) is what it
 * means, not what the query string spells.
 *
 * `DelveStage.tsx`'s own D5.4 doc comment already named the six in prose — "pack, wild talk, event,
 * object prompt, supply, fight input" — matching this set one-for-one.
 */
export type DelvePanelId = "pack" | "talk" | "event" | "object" | "supply" | "fight";

export const DELVE_PANEL_IDS: readonly DelvePanelId[] = ["pack", "talk", "event", "object", "supply", "fight"];

/**
 * Normalizes the raw `searchParams.get("panel")` string into a known panel id, or `null`.
 *
 * `null` covers two different raw inputs on purpose, collapsed to one value: `raw === null` ("no panel
 * requested") and a non-null string outside the six known ids ("a panel was requested that this build
 * doesn't recognise" — a stale bookmark, a future id this build predates, a typo). Both read as
 * "nothing to show" to every caller. `DelveStage.tsx`'s own escape-claim effect and `DelvePanelHost`'s
 * own `open` flag both key off this single normalized value, never the raw string, so an unrecognised
 * `?panel=` value opens no dialog AND never blocks the stage's own Esc claim the way leaving the raw
 * string in place would (the escape effect only skips claiming when a panel is actually about to
 * render) — see `DelveStage.tsx`'s own doc comment for why this is the deliberately smaller, safer fix
 * over adding a second effect that rewrites the URL for the unrecognised case.
 */
export function toDelvePanelId(raw: string | null): DelvePanelId | null {
  return raw != null && (DELVE_PANEL_IDS as readonly string[]).includes(raw) ? (raw as DelvePanelId) : null;
}

/**
 * The band-2 dialog title per panel — spec §7's own row names for each surface ("Pack", "Wild talk",
 * "Event", "Object prompt", "Supply bag"); "Fight" is this file's own shortening of §7's "Fight panel"
 * row, matching the brevity of the other five (none of which repeat the word "panel" in its own title).
 * Plain strings, not Lingui `msg` descriptors — `labels.ts`'s own doc comment already names why this
 * program's delve vocabulary is plain TypeScript rather than the `messages.po` convention §8's prose
 * describes: no non-JSX `.ts` file in this tree yet builds an id→`msg` lookup table, and the one real
 * sibling to mirror (`stages/world/labels.ts`) is plain too. Kept here rather than in `labels.ts`
 * itself since a panel's title is this task's own routing vocabulary (paired one-for-one with
 * `DelvePanelId`), not the wire-id vocabulary (room kinds, verbs, bands) `labels.ts` otherwise holds.
 */
const PANEL_TITLES: Readonly<Record<DelvePanelId, string>> = {
  pack: "Pack",
  talk: "Wild talk",
  event: "Event",
  object: "Object prompt",
  supply: "Supply bag",
  fight: "Fight"
};

export function delvePanelTitle(panel: DelvePanelId): string {
  return PANEL_TITLES[panel];
}
