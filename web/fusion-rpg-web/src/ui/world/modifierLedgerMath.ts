import type { Magnitude, UpkeepBreakdownView } from "@/contract/types";

/**
 * The modifier ledger's arithmetic (world-numbers W41) — GG-49's answer to "why did my net income
 * drop?". **The rows are not a design choice**: they are exactly the five additive operands
 * of `LoamUpkeep.BreakdownFor` (`LoamUpkeep.cs:40`) — base, garrison, development, danger, wonder —
 * in that order. The fifth operand (`wonderUpkeep`, wonder-wire §Design 3, plan Task 4A.4) rode
 * `reproducedTotal`'s sum first; its ROW is wonder-display's module (4D.4) and lands here.
 * Depth is capped at three levels; a fourth would be the tuning file, not this ledger.
 *
 * **Named `modifierLedgerMath.ts`, not `modifierLedger.ts` (the task's own file list).** The two
 * differ only by the first letter's case from `ModifierLedger.tsx` in this same directory —
 * genuinely broken on this Windows machine's case-insensitive filesystem: `ModifierLedger.tsx`'s
 * own `import ... from "./modifierLedger"` resolved back to itself instead of this file, producing
 * a circular self-import where `ModifierLedger` was still `undefined` at render time. Found live by
 * `ModifierLedger.test.tsx` (7/11 cases failing with "Element type is invalid… got: undefined"),
 * not assumed — fixed by the rename, which real environment `require`/`import` resolution needs
 * regardless of platform, not merely a workaround for this one machine.
 */
export type ModifierLedgerRowKey = "base" | "garrison" | "development" | "danger" | "wonder";

export type ModifierLedgerRow = { key: ModifierLedgerRowKey; amount: Magnitude };

/** Exactly the five rows, in the engine's own operand order — nothing else, ever. */
export function ledgerRows(breakdown: UpkeepBreakdownView): ModifierLedgerRow[] {
  return [
    { key: "base", amount: breakdown.base },
    { key: "garrison", amount: breakdown.garrison },
    { key: "development", amount: breakdown.development },
    { key: "danger", amount: breakdown.danger },
    { key: "wonder", amount: breakdown.wonderUpkeep }
  ];
}

/**
 * `(base + garrison + development + danger + wonderUpkeep) × intensityMilli × handicapMilli ÷
 * 1_000_000` — **one** division, truncating (matching `long` integer division on the C# side,
 * never a floating-point round), never two roundings. Reading down the column must reproduce this
 * exactly, or the ledger lies about its own total.
 *
 * One documented gap versus the engine's true four-factor Total (`BreakdownFor`: sum ×
 * intensity × handicap × season ÷ 1_000_000_000): `seasonMilli` rides no DTO field (the Ask-first
 * adjacent staleness Task 4A.4 flags — exposing it is display's follow-up, not this module's
 * whenever the season is neutral (1000); the server-side ledger-reproduction test
 * (`WorldUpkeepBreakdownProjectionTests` + `WorldWonderWireTests`) proves the full four-factor
 * agreement including the real season, so the wire never ships a total its ledger cannot reproduce.
 */
export function reproducedTotal(breakdown: UpkeepBreakdownView): number {
  const sum = breakdown.base.value + breakdown.garrison.value + breakdown.development.value + breakdown.danger.value + breakdown.wonderUpkeep.value;
  return Math.trunc((sum * breakdown.intensityMilli.value * breakdown.handicapMilli.value) / 1_000_000);
}
