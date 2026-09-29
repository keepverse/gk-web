import { create } from "zustand";
import { useToastStack } from "@/shell/toastStack";

/**
 * D5.9 (spec-delve-stage.md §7's band-4 row: "Drops · level-ups · a wild creature joining · a first
 * clear … Queued, never racing band 3: a report arriving while the summary is open waits behind it").
 *
 * **A genuinely separate mechanism from the shell's own `toastStack.ts`, layered on top of it rather
 * than duplicating its rendering — a deliberate choice, not the only one, so the reasoning is written
 * down.** `shell/Toasts.tsx`/`toastStack.ts` already exists, is mounted shell-wide, and its own
 * `VISIBLE_CAP = 3` (`Toasts.tsx:13`) caps how many toasts are *shown at once* — anything past that
 * sits behind a `"+N more"` count, never merged (`Toasts.tsx:27-31`). Spec §12's own `reveal.maxQueued`
 * (`gk-core/data/tuning/delve-ui.v1.json`: `"reveal": {"toastMs": 4000, "maxQueued": 3}`) is a **different**
 * rule with the same number: "above [3], queued reports **collapse into one summary report**" — a
 * content merge, not a display cap, and it only applies to reports that arrived **while held** (i.e.
 * while the extraction summary, band 3, was open), never to the shell's general-purpose toast traffic.
 * Reusing `toastStack.ts`'s own store/render pipeline for the actual on-screen band-4 surface (no
 * second `<Toasts/>`-shaped component, no second ARIA live region, no second dismiss affordance) and
 * adding this queue as a thin, delve-only layer *in front of* it is the smaller, more honest change:
 * it reuses real, already-mounted UI for the parts that are genuinely identical (a band-4 card that
 * auto-expires and never blocks input) and owns only the parts that are genuinely delve-specific (the
 * hold-while-band-3-is-open rule and the maxQueued collapse), rather than mutating `toastStack.ts`'s
 * own generic semantics for every other caller in the app to carry a delve-only rule.
 *
 * **No real production caller exists for `push` today, named honestly rather than hidden**: no
 * producer anywhere composes a drop/level-up/join/first-clear event at the extraction boundary
 * (`ExtractionView`'s own doc comment, `contract/types.ts:1292-1296`: "'level-ups' and 'joins' … have
 * no producer anywhere … every one of those stays `Pending`, named, rather than invented"). This
 * module is the queuing MECHANISM only — the timing/ordering/collapse rule — built and proven against
 * a caller-supplied `{kind, title, message}` shape a future producer will fill in; it does not invent
 * per-kind display copy for content nobody has authored yet (the same restraint
 * `ObjectPromptPanel.tsx`'s own doc comment already applies to an unbuilt per-verb shape).
 */

export type DelveReportKind = "drop" | "levelUp" | "join" | "firstClear";

export type DelveReportEntry = {
  kind: DelveReportKind;
  title: string;
  message?: string;
};

// spec-delve-stage.md §12 / gk-core/data/tuning/delve-ui.v1.json's own `reveal` key, MIRRORED here as local
// constants rather than read live. Confirmed, not assumed: a repo-wide search of `gk-web/web/fusion-rpg-web/src`
// for "delve-ui", "reveal.toastMs" and "reveal.maxQueued" returns zero hits — no wire path delivers
// this module's own tunables to the client today, the same already-recorded gap D5.12 found for
// `DelveUiPresentSink.cs`'s own duration ("a plain constructor parameter, never loaded [from tuning]
// here"). If a future task wires the projection to carry these (spec §12's own "delivered on the
// projection so the client carries no copy"), this pair moves onto that field — matching every other
// "session-delivered, not a client constant" tunable this stage already keeps (§12's own `dwell.*` row).
const REVEAL_TOAST_MS = 4000;
const REVEAL_MAX_QUEUED = 3;

type DelveReportQueueState = {
  held: boolean;
  pending: DelveReportEntry[];
  /** The extraction summary (band 3) opened — every report from here on waits instead of showing. */
  hold: () => void;
  /** The extraction summary closed — flush whatever queued while it was open, in order (or collapsed,
   * past `REVEAL_MAX_QUEUED`), then resume showing new reports immediately. */
  release: () => void;
  push: (entry: DelveReportEntry) => void;
};

/** Exactly `reveal.maxQueued` (3) individual reports stay individual; the fourth and beyond collapse
 * into ONE combined report rather than four separate ones — spec §12's own literal "above it" wording,
 * so 3 is still the individual case and only 4+ collapses. A plain count, not a per-kind breakdown or
 * per-entry titles: the combined report never guesses at content richer than what it was given. */
function collapse(entries: DelveReportEntry[]): DelveReportEntry {
  return {
    kind: entries[0]!.kind,
    title: `${entries.length} more results from this raid`
  };
}

function flushToToasts(entries: DelveReportEntry[]): void {
  if (entries.length === 0) return;
  const push = useToastStack.getState().push;
  if (entries.length > REVEAL_MAX_QUEUED) {
    const combined = collapse(entries);
    push({ tone: "ok", title: combined.title }, REVEAL_TOAST_MS);
    return;
  }
  for (const entry of entries) {
    push({ tone: "ok", title: entry.title, message: entry.message }, REVEAL_TOAST_MS);
  }
}

export const useDelveReportQueue = create<DelveReportQueueState>((set, get) => ({
  held: false,
  pending: [],
  hold: () => set({ held: true }),
  release: () => {
    const { pending } = get();
    flushToToasts(pending);
    set({ held: false, pending: [] });
  },
  push: (entry) => {
    if (!get().held) {
      flushToToasts([entry]);
      return;
    }
    set((state) => ({ pending: [...state.pending, entry] }));
  }
}));
