import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Magnitude, UpkeepBreakdownView } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { formatMagnitude } from "@/i18n/magnitude";
import { ledgerRows, reproducedTotal, type ModifierLedgerRowKey } from "./modifierLedgerMath";

/**
 * GG-49's answer to "why did my net income drop?" (world-numbers W41/W42). A hover/focus card over
 * the upkeep total, its five rows read straight off the wire — never re-derived — plus the WCAG
 * 1.4.13 obligations content-on-hover-or-focus owes:
 *
 * - **Dismissible** — Esc closes it without moving the pointer, and does nothing else (it never
 *   pops a layer above it — this is stage chrome, not a `PanelShell` panel).
 * - **Hoverable** — the pointer can travel from the trigger into the popup without it vanishing; a
 *   short grace delay on `mouseleave` survives the gap between two adjacent elements.
 * - **Persistent** — it never times out on its own; it closes only on dismissal, the pointer
 *   leaving both elements, or the underlying value changing.
 * - **Keyboard** — Enter on the focused trigger opens it *locked* (immune to a stray blur/mouseleave)
 *   with its rows already in the DOM, in the tab order.
 */
const ROW_LABELS: Record<ModifierLedgerRowKey, string> = {
  base: "base upkeep",
  garrison: "garrison",
  development: "development",
  danger: "danger",
  // wonder-display 4D.4 (spec §Design 6 backend term `wonder-effect-empire`): the fifth ledger
  // row, straight off `sector.loam.upkeepBreakdown.wonderUpkeep` — never re-derived here.
  wonder: "wonder upkeep"
};

/** Long enough to survive the real gap between two adjacent DOM elements, short enough that a
 * genuine pointer-away reads as closed promptly. */
const HOVER_GRACE_MS = 60;

export type ModifierLedgerProps = {
  breakdown: Pending<UpkeepBreakdownView>;
  total: Magnitude;
};

export function ModifierLedger({ breakdown, total }: ModifierLedgerProps) {
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistent, but only up to a point: the underlying value changing closes it outright, locked
  // or not — a stale breakdown left open over a number that just moved would show the wrong story.
  useEffect(() => {
    setOpen(false);
    setLocked(false);
  }, [total.value, breakdown.state]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function cancelScheduledClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    if (locked) return;
    cancelScheduledClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_GRACE_MS);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter") {
      cancelScheduledClose();
      setOpen(true);
      setLocked(true);
    } else if (event.key === "Escape" && open) {
      // Dismissible: closes only this popup, never bubbles to pop anything above it.
      event.stopPropagation();
      cancelScheduledClose();
      setOpen(false);
      setLocked(false);
    }
  }

  if (breakdown.state !== "known") {
    return (
      <span data-testid="modifier-ledger-pending" className="text-sm text-muted">
        {breakdown.state === "pending" ? breakdown.reason : "not available"}
      </span>
    );
  }

  const rows = ledgerRows(breakdown.value);
  const computedTotal = reproducedTotal(breakdown.value);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        data-testid="modifier-ledger-trigger"
        aria-expanded={open}
        className="text-sm text-text underline decoration-dotted"
        onMouseEnter={() => {
          cancelScheduledClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!locked) scheduleClose();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        {formatMagnitude(total)} loam
      </button>

      {open ? (
        <div
          data-testid="modifier-ledger-popup"
          role="group"
          aria-label="upkeep breakdown"
          onMouseEnter={cancelScheduledClose}
          onMouseLeave={scheduleClose}
        >
          {rows.map((row) => (
            <div key={row.key} data-testid={`modifier-ledger-row-${row.key}`}>
              <span>{ROW_LABELS[row.key]}</span>{" "}
              <span data-testid={`modifier-ledger-amount-${row.key}`}>{formatMagnitude(row.amount)}</span>
            </div>
          ))}
          <div data-testid="modifier-ledger-computed-total">{computedTotal} loam</div>
        </div>
      ) : null}
    </span>
  );
}
