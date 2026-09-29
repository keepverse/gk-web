import { useState } from "react";
import type { VaultView } from "@/contract/types";
import { vaultHeaderOwner, vaultPhase } from "@/contract/vaultView";

export type VaultBlockState = "loading" | "error" | "ready";

export type VaultBlockProps = {
  /** One sector's vault (`adaptSectorStorage`), or null while the read has not answered. */
  vault: VaultView | null;
  state: VaultBlockState;
  error?: string | null;
  onRetry?: () => void;
};

/**
 * empire-inventory-surfaces `storage-cache-ui` §Design 1 (plan Task 4D.2a) — the vault block,
 * a pure function of one sector's `VaultView` (no hooks beyond the local search filter, no
 * `QueryClientProvider` needed — the caller fetches, exactly the `delveDoorVerb` split
 * `SectorInspector` already establishes).
 *
 * Slots, in recipe order: vault-header ("held by X", live `OwnerFactionId`) +
 * capacity-meter[room] (binds `SlotsUsed`/`SlotCapacity`, never computes) + tool-search +
 * stock-row* (seq order, stored state) + phase-bindings. Put-in / take-out live in the
 * inspector's Actions region via the generic `ActionCluster` (filed by the caller through
 * 4A.1's kinds) — never as buttons here, so this block takes no order and fires no toast
 * (winner-no-toast: the header already says "held by" them).
 *
 * Fog prohibition: rows render exactly as listed — no position compare, no void/empty
 * filtering, no `visible` handling (`VaultRowView` carries neither member).
 */
export function VaultBlock({ vault, state, error, onRetry }: VaultBlockProps) {
  const [filter, setFilter] = useState("");

  if (state === "error") {
    return (
      <div data-testid="vault-block" data-phase="error">
        <h4 className="mb-1 font-display text-sm text-text">Vault</h4>
        <div data-testid="vault-phase-error" data-phase="error" role="status">
          <strong>phase-error</strong>
          <span>{error ?? "The vault could not be read."}</span>
          {onRetry ? (
            <button type="button" data-testid="vault-retry" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (vault == null) {
    return (
      <div data-testid="vault-block" data-phase="loading">
        <h4 className="mb-1 font-display text-sm text-text">Vault</h4>
        <div data-testid="vault-phase-loading" data-phase="loading" role="status">
          <strong>phase-loading</strong>
          <span>Loading the vault…</span>
        </div>
      </div>
    );
  }

  const phase = vaultPhase(vault);
  const owner = vaultHeaderOwner(vault);

  if (phase === "locked") {
    return (
      <div data-testid="vault-block" data-phase="locked">
        <h4 className="mb-1 font-display text-sm text-text">Vault</h4>
        <p data-testid="vault-header">held by {owner ?? "—"}</p>
        <div data-testid="vault-phase-locked" data-phase="locked" role="status">
          <strong>phase-locked</strong>
          <span>No vault built — raise a relic-vault to store packs here.</span>
        </div>
      </div>
    );
  }

  const needle = filter.trim().toLowerCase();
  const rows =
    needle.length === 0
      ? vault.rows
      : vault.rows.filter((row) =>
          (row.containerId ?? row.instanceId ?? "").toLowerCase().includes(needle)
        );

  return (
    <div data-testid="vault-block" data-phase={phase}>
      <h4 className="mb-1 font-display text-sm text-text">Vault</h4>
      <p data-testid="vault-header">held by {owner ?? "—"}</p>
      <div
        data-testid="vault-room"
        data-used={vault.slotsUsed.value}
        data-capacity={vault.slotCapacity.value}
        data-room={vault.room.value}
      >
        {vault.room.value} of {vault.slotCapacity.value} rooms open
      </div>
      <input
        data-testid="vault-search"
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter stored packs"
        aria-label="Filter stored packs"
      />
      {phase === "empty" ? (
        <div data-testid="vault-phase-empty" data-phase="empty" role="status">
          <strong>phase-empty</strong>
          <span>Vault empty — send a band with goods.</span>
        </div>
      ) : (
        <ul data-testid="vault-rows" className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.seq} data-testid={`vault-row-${row.seq}`}>
              {row.containerId ?? row.instanceId ?? `row ${row.seq}`}
              {row.qty != null ? ` · ${row.qty}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
