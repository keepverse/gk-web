import { useMutation } from "@tanstack/react-query";
import { useFileClaimCache, useSubmitWorldCommands } from "@/lib/bus/world";
import { orderId } from "@/stages/world/worldSelection";
import type {
  LegionCargoBusAction,
  LegionSheetTabId
} from "@/contract/types";

/**
 * empire-inventory-surfaces `legion-sheet` (plan Task 4D.1, spec §Design 6) —
 * the `cargo-actions` closed bus.
 *
 * Filing only: every event files through the existing submit path
 * (`useSubmitWorldCommands` over `POST /{worldId}/commands`) or the claims
 * filer (`useFileClaimCache`) — never a direct verb call, never inline
 * mutation (the two-write lock). Resolution is read back (turn report +
 * `GET .../cargo`), never inferred from the filer's `ok` (GG-15).
 *
 * No weight field on any event or request (Locked anchors — mass resolves
 * server-side at commit through 4A.1's weight resolver, or a client could
 * mint capacity). Idempotency reuses the queue's own `orderId(turn, kind,
 * entityId)` shape — never a second key; `correlationId := CommandId` end
 * to end for the pick-up path. The bus carries all six cargo kinds so
 * `storage-cache-ui` reuses it for deposit/withdraw/claim, but this tab's
 * recipe exposes only load / unload / hand-to-band.
 *
 * Contract-guard note: this file lives under `stages/` (guarded), so it
 * holds no `import type ... from "@/lib/bus/..."` — request shapes are
 * plain object literals checked structurally against the mutation params,
 * and the closed tab/action vocabularies come from `@/contract/types`.
 */

/** The tab ids this sheet may show — re-exported for the host (closed, spec §Design 1). */
export const LEGION_SHEET_TABS: LegionSheetTabId[] = ["overview", "cargo"];

/** This tab's three exposed actions — everything else on the bus is carried, not bound here. */
export const CARGO_TAB_ACTIONS = ["cargo.load", "cargo.unload", "cargo.hand-to-band"] as const;

export type CargoTabActionType = (typeof CARGO_TAB_ACTIONS)[number];

/** A filed cargo order's wire kind (4A.1's six, verbatim). */
export function cargoWireKind(action: LegionCargoBusAction): string {
  switch (action.type) {
    case "cargo.load":
      return "load-cargo";
    case "cargo.unload":
      return "unload-cargo";
    case "cargo.hand-to-band":
      return "transfer-cargo";
    case "cargo.deposit":
      return "deposit-cargo";
    case "cargo.withdraw":
      return "withdraw-cargo";
    case "cache.pick-up":
      return "claim-cache";
  }
}

/**
 * Build the `POST /{worldId}/commands` request body for one bus action.
 * Field-for-field with `WorldDtos.cs:554-573` (the `stance`-loss precedent:
 * a field the queue carries and the wire drops is lost silently — so every
 * cargo field is set here explicitly, and `weightEach` never appears).
 */
export function buildCargoCommandBody(
  action: LegionCargoBusAction,
  commandId: string
): Record<string, string | number | string[] | null> {
  const base = { commandId, kind: cargoWireKind(action) };
  switch (action.type) {
    case "cargo.load":
      return {
        ...base,
        entityId: action.entityId,
        cargoKind: action.cargoKind,
        instanceId: action.instanceId ?? null,
        containerId: action.containerId ?? null,
        qty: action.qty ?? null
      };
    case "cargo.unload":
      return { ...base, entityId: action.entityId, seq: action.seq };
    case "cargo.hand-to-band":
      return {
        ...base,
        entityId: action.entityId,
        targetEntityId: action.targetEntityId,
        seq: action.seq
      };
    case "cargo.deposit":
    case "cargo.withdraw":
      return {
        ...base,
        entityId: action.entityId,
        sectorId: action.sectorId,
        seq: action.seq
      };
    case "cache.pick-up":
      // Filed via the claims filer (`useFileClaimCache`), not `/commands` —
      // this arm exists so the kind mapping stays total; callers route it
      // through `buildClaimBody` below.
      return { ...base, entityId: action.entityId, cacheId: action.cacheId };
  }
}

/** The claims-filer body for `cache.pick-up` (`correlationId := CommandId`). */
export function buildClaimBody(commandId: string, cacheId: string): { commandId: string; cacheId: string } {
  return { commandId, cacheId };
}

/** Idempotency key — the queue's own shape, extended to cargo kinds (never a second key). */
export function cargoCommandId(turn: number, wireKind: string, entityId: string): string {
  return orderId(turn, wireKind, entityId);
}

export type FileCargoActionVars = {
  action: LegionCargoBusAction;
  turn: number;
  commanderId?: string;
};

/**
 * File one tab action. Answers filing (`filed` / `replayed` /
 * `refused-at-submit` via the result's `ok`/`reason`/`replayed`); the
 * outcome arrives through the turn report + read-backs. Cargo rows are
 * untouched until commit (GG-15) — so this hook invalidates nothing here;
 * the commit hook owns `["world"]` invalidation.
 */
export function useFileCargoAction(worldId: string | null | undefined) {
  const submit = useSubmitWorldCommands(worldId);
  const claim = useFileClaimCache(worldId);
  const file = useMutation({
    mutationFn: async (vars: FileCargoActionVars) => {
      if (vars.action.type === "cache.pick-up") {
        const commandId = cargoCommandId(vars.turn, "claim-cache", vars.action.entityId);
        return claim.mutateAsync({
          entityId: vars.action.entityId,
          body: {
            ...(vars.commanderId ? { commanderId: vars.commanderId } : {}),
            ...buildClaimBody(commandId, vars.action.cacheId)
          }
        });
      }
      const commandId = cargoCommandId(vars.turn, cargoWireKind(vars.action), vars.action.entityId);
      const command = buildCargoCommandBody(vars.action, commandId);
      return submit.mutateAsync({
        ...(vars.commanderId ? { commanderId: vars.commanderId } : {}),
        // Structurally a `WorldCommandRequest` (checked against the mutation
        // params without a guarded type import); never carries `weightEach`.
        commands: [command as unknown as Parameters<typeof submit.mutateAsync>[0]["commands"][number]]
      });
    }
  });
  return file;
}

/** `POST /{worldId}/commit` for the sheet's turn cluster (re-reads cargo after advance). */
export { useCommitWorldTurn } from "@/lib/bus/world";
