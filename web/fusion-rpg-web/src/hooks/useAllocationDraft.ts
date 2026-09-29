import { useEffect, useState } from "react";

/**
 * The shared draft/dirty/budget/save flow `AptitudesPage.tsx` and `ProgressionTab.tsx` each hand-rolled
 * (passive-tree-todo.md I2, spec-tree-surface.md §12). `ProgressionTab.tsx`'s own comment named the
 * fix before this task landed: "the aptitude half is AptitudesPage.tsx's own draft/dirty/budget/save
 * logic, copied verbatim... If this drifts, the fix is extracting a shared useAptitudeAllocation()
 * hook, not maintaining two copies by hand." This is that extraction, generalised past aptitudes: a
 * tree-spend flow (I3+) reads/writes a `Record<string, number>` allocation exactly the same shape
 * (skill points here, souls or aptitude points there), so the hook takes the server values, budget and
 * save callback as plain inputs rather than importing an aptitude-specific bus hook itself.
 *
 * Draft rules preserved byte-for-byte from the two call sites this replaces:
 * - the draft re-seeds from the server ONLY the first time server data arrives (never while the
 *   player is mid-edit — re-seeding on every server refetch would silently discard an unsaved edit);
 * - `spent` sums the draft's own values, `withinBudget` never clamps the input (PS-8) -- a value over
 *   budget still renders exactly what was typed, only the save affordance disables;
 * - `dirty` is a value comparison against the server's last-known state, not the draft's own history.
 */
export interface UseAllocationDraftArgs {
  /** The server's current, COMMITTED allocation, or `undefined` while it has not loaded yet. `dirty`
   * and `revert` always compare/restore against THIS value, never `initialValues` below — the last
   * thing the server actually saved is the only honest "nothing pending" baseline (GG-15). */
  serverValues: Record<string, number> | undefined;
  /** passive-tree-todo.md I8 — what the draft SEEDS from the one time it seeds (`draft === null`),
   * when that differs from `serverValues` itself. A caller with an outside, longer-lived pending
   * value (`PassivesTab`'s own lifted Plan, spec-tree-surface.md §5.1: "a Plan outlives the panel")
   * passes the Plan-merged view here so reopening a panel shows the pending edit again, WITHOUT that
   * pending value ever being mistaken for "already committed" — `dirty`/`revert` still read
   * `serverValues` only. Defaults to `serverValues` when omitted, which is exactly I7's original
   * behaviour (byte-identical for every caller that doesn't pass this — `AptitudesPage`/
   * `ProgressionTab` included). */
  initialValues?: Record<string, number>;
  /** The total budget `spent` is checked against — `withinBudget` is `spent <= budget`. */
  budget: number;
  /** The caller's own mutation-pending flag (e.g. a react-query mutation's `isPending`) — this hook
   * tracks no save-in-flight state of its own, so two callers sharing one save mutation never race. */
  isSaving: boolean;
  /** Commits the whole draft. Never a per-id call — the draft is submitted as one complete record,
   * matching every allocation endpoint's own "one whole allocation, never a per-node call" shape. */
  onSave: (draft: Record<string, number>) => Promise<unknown>;
}

export interface UseAllocationDraftResult {
  /** `null` until the server values have arrived once. */
  draft: Record<string, number> | null;
  /** Sets one id's value in the draft, clamped to `>= 0` and truncated to a whole number (PS-8 never
   * clamps to the BUDGET, only to a legal non-negative integer point count). */
  setValue: (id: string, next: number) => void;
  /** Restores the draft to the last-known server values, discarding any unsaved edit. */
  revert: () => void;
  /** After a successful commit, replace draft with the server's reply (species revert → baseline). */
  acceptCommitted: (values: Record<string, number>) => void;
  spent: number;
  withinBudget: boolean;
  dirty: boolean;
  error: string | null;
  /** Commits the current draft via `onSave`, surfacing a thrown error as `error` rather than letting
   * it escape uncaught. */
  save: () => Promise<void>;
}

export function useAllocationDraft({
  serverValues,
  initialValues,
  budget,
  isSaving,
  onSave
}: UseAllocationDraftArgs): UseAllocationDraftResult {
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the draft whenever the server state first arrives -- never while the player holds an
  // unsaved edit (draft !== null already means "the player has a draft," seeded or edited alike).
  // Seeds from `initialValues` when a caller supplies one (I8's Plan-merged view), `serverValues`
  // otherwise -- but `dirty`/`revert` below ALWAYS compare/restore against `serverValues`, never
  // `initialValues`, so a seeded-in pending value still reads as unsaved rather than as "already
  // committed."
  useEffect(() => {
    if (serverValues && draft === null) setDraft(initialValues ?? serverValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverValues, draft]);

  const spent = draft ? Object.values(draft).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0) : 0;
  const withinBudget = spent <= budget;
  const dirty = draft !== null && serverValues !== undefined && JSON.stringify(draft) !== JSON.stringify(serverValues);

  function setValue(id: string, next: number) {
    setDraft((d) => ({ ...(d ?? {}), [id]: Math.max(0, Math.trunc(next)) }));
  }

  function revert() {
    if (serverValues) setDraft(serverValues);
  }

  function acceptCommitted(values: Record<string, number>) {
    setDraft(values);
    setError(null);
  }

  async function save() {
    if (draft === null || isSaving) return;
    setError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return { draft, setValue, revert, acceptCommitted, spent, withinBudget, dirty, error, save };
}
