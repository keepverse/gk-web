import type { SectorView } from "@/contract/types";

/**
 * Block 8 (world-stage W63) — `WardenBindingId` is a real, owner-gated wire field
 * (`WorldEndpoints.cs:451-452`), found stale as "no DTO field" and fixed at the adapter level
 * (`adapt.ts`, this same task): `known(null)` today is the honest answer *"no warden is bound"*,
 * not a placeholder — no sector has one yet because the binding **verb** itself doesn't exist until
 * `world-confirms` (Phase 4). This block never offers a verb the command vocabulary lacks (same
 * derivation as the cede embargo, W60): it states the fact, nothing more.
 */
export function WardenBlock({ sector }: { sector: SectorView }) {
  return (
    <div data-testid="warden-block">
      <h4 className="mb-1 font-display text-sm text-text">Warden</h4>
      {sector.wardenBindingId.state === "known" ? (
        <p className="text-sm text-text">{sector.wardenBindingId.value ?? "No warden bound."}</p>
      ) : sector.wardenBindingId.state === "pending" ? (
        <p className="text-sm text-muted">{sector.wardenBindingId.reason}</p>
      ) : (
        <p className="text-sm text-muted">No warden bound.</p>
      )}
    </div>
  );
}
