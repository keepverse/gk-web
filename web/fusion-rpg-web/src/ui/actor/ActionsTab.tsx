import { useState } from "react";
import type { ActorView } from "@/contract/types";
import { useAuraCatalog, useAuraRuntime, useDisableAura, useEnableAura } from "@/lib/bus/aura";
import { useActionLoadout, useDiscardUnlock, useSetLoadout } from "@/lib/bus/action";
import { AuraSlot, type AuraSlotState } from "./AuraSlot";
import { ActionSlot, type ActionSlotState } from "./ActionSlot";
import { ConfirmDialog } from "@/ui/ConfirmDialog";

/** aura-skill T18c: which pool + how much per tick, from real authored cost rows (never
 * fabricated) — undefined (renders nothing) when no cost has been authored for this aura yet, which
 * is every aura's real state today (`grep -rn PerTick data/` finds zero hits). Takes a plain
 * structural shape rather than an imported DTO type — `ui/` binds to values, not `@/lib/bus` types
 * (this repo's own contractGuard). */
function upkeepNoteFor(upkeep: { resourceId: string; amountMin: number; amountMax: number; when: string }[]): string | undefined {
  if (upkeep.length === 0) return undefined;
  return upkeep
    .map((c) => `${c.amountMin === c.amountMax ? c.amountMin : `${c.amountMin}-${c.amountMax}`} ${c.resourceId} ${c.when === "PerTick" ? "per tick" : "on cast"}`)
    .join(", ");
}

const REFUSAL_TEXT: Record<string, string> = {
  NotEquipped: "Not equipped — assign it in your loadout first",
  AlreadyActive: "Already active",
  // A30 (T70): LoadoutRejectionReason (SpecimenLoadoutEndpoints.cs's `SetLoadout` conflict) and
  // DiscardRefusalReason (UnlockDiscardEndpoints.cs) wire values, matched to the C# enum's own
  // `ToString()` spelling — never a generic "request failed" string (GG-55).
  MidRun: "Frozen for this run — try again after the match",
  LoadoutFull: "Loadout is full — unequip something first",
  DuplicateInLoadout: "Already in your loadout",
  IntrinsicNotEquippable: "This is a basic/innate action — always available, never equipped",
  ActionNotHeld: "You don't hold this action",
  NotHeld: "Not held — nothing to discard",
  InsufficientSoul: "Not enough souls to discard this"
};

/**
 * aura-skill T18c (`spec-aura-surface.md`): real aura slots. A30 (T70): the regular-action grid below
 * is now real too — `PLACEHOLDER_ACTIONS`/`LockedGridSlot` are gone, replaced by A27/A28's real
 * held/equipped/discard surface (`lib/bus/action.ts`).
 */
export function ActionsTab({ data }: { data: ActorView }) {
  const catalog = useAuraCatalog();
  const runtime = useAuraRuntime(data.playerId);
  const enable = useEnableAura(data.playerId);
  const disable = useDisableAura(data.playerId);

  const loadout = useActionLoadout(data.instanceId);
  const setLoadout = useSetLoadout(data.instanceId);
  const discardUnlock = useDiscardUnlock(data.instanceId);

  // Per-slot transient UI state: a refusal reason (409/400) or an eviction note (GG-55 — "enabling X
  // switched off Y" must survive long enough to read, not vanish with the toast). Aura and action
  // notes share one map, namespaced by a prefix, so an aura refusal and an action refusal can never
  // collide on the same key.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingDiscardId, setPendingDiscardId] = useState<string | null>(null);

  if (catalog.isLoading || runtime.isLoading || loadout.isLoading) {
    return (
      <div className="mt-4" data-testid="actions-tab-loading">
        Loading auras…
      </div>
    );
  }

  const auras = catalog.data?.items ?? [];
  const activeIds = new Set(runtime.data?.activeAuraIds ?? []);
  const equippedIds = new Set(runtime.data?.equippedAuraIds ?? []);

  function stateFor(auraId: string): AuraSlotState {
    if (activeIds.has(auraId)) return "active";
    if (equippedIds.has(auraId)) return "equipped-inactive";
    return "locked";
  }

  function setNote(auraId: string, note: string | undefined) {
    setNotes((prev) => {
      const next = { ...prev };
      if (note) next[auraId] = note;
      else delete next[auraId];
      return next;
    });
  }

  function handleEnable(auraId: string) {
    setNote(auraId, undefined);
    enable.mutate(auraId, {
      onSuccess: (result) => {
        if (result.evictedAuraId) {
          setNote(result.evictedAuraId, `Switched off — ${auraId} took its slot`);
        }
      },
      onError: (err) => {
        const reason = err instanceof Error ? REFUSAL_TEXT[err.message] ?? err.message : "Could not enable";
        setNote(auraId, reason);
      }
    });
  }

  function handleDisable(auraId: string) {
    setNote(auraId, undefined);
    disable.mutate(auraId);
  }

  // ---- Regular actions (A30, T70) ----
  const heldActionIds = loadout.data?.heldActionIds ?? [];
  const equippedActionIds = loadout.data?.actionIds ?? [];
  const equippedActionIdSet = new Set(equippedActionIds);

  function actionStateFor(actionId: string): ActionSlotState {
    // "equipped-cooldown" has no live signal yet (ActionSlot's own doc comment) — every equipped
    // action renders "equipped" until real per-action cooldown telemetry reaches the FE.
    return equippedActionIdSet.has(actionId) ? "equipped" : "held";
  }

  function actionNoteKey(actionId: string) {
    return `action:${actionId}`;
  }

  function setActionNote(actionId: string, note: string | undefined) {
    setNote(actionNoteKey(actionId), note);
  }

  function handleEquip(actionId: string) {
    setActionNote(actionId, undefined);
    setLoadout.mutate([...equippedActionIds, actionId], {
      onError: (err) => {
        const reason = err instanceof Error ? REFUSAL_TEXT[err.message] ?? err.message : "Could not equip";
        setActionNote(actionId, reason);
      }
    });
  }

  function handleUnequip(actionId: string) {
    setActionNote(actionId, undefined);
    setLoadout.mutate(
      equippedActionIds.filter((id) => id !== actionId),
      {
        onError: (err) => {
          const reason = err instanceof Error ? REFUSAL_TEXT[err.message] ?? err.message : "Could not unequip";
          setActionNote(actionId, reason);
        }
      }
    );
  }

  function requestDiscard(actionId: string) {
    setPendingDiscardId(actionId);
  }

  function confirmDiscard() {
    const actionId = pendingDiscardId;
    if (!actionId) return;
    setPendingDiscardId(null);
    setActionNote(actionId, undefined);
    discardUnlock.mutate(actionId, {
      onError: (err) => {
        const reason = err instanceof Error ? REFUSAL_TEXT[err.message] ?? err.message : "Could not discard";
        setActionNote(actionId, reason);
      }
    });
  }

  return (
    <div className="mt-4" data-testid="actions-tab">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="actions-tab-auras">
        {auras.map(({ auraId, upkeep }) => {
          const state = stateFor(auraId);
          return (
            <AuraSlot
              key={auraId}
              auraId={auraId}
              state={state}
              lockedReason={state === "locked" ? REFUSAL_TEXT.NotEquipped : undefined}
              refusalReason={notes[auraId]}
              upkeepNote={upkeepNoteFor(upkeep)}
              busy={enable.isPending || disable.isPending}
              onEnable={() => handleEnable(auraId)}
              onDisable={() => handleDisable(auraId)}
            />
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="actions-tab-actions">
        {heldActionIds.length === 0 ? (
          <div className="col-span-full text-2xs text-muted" data-testid="actions-tab-actions-empty">
            No unlocked actions yet
          </div>
        ) : (
          heldActionIds.map((actionId) => (
            <ActionSlot
              key={actionId}
              actionId={actionId}
              state={actionStateFor(actionId)}
              refusalReason={notes[actionNoteKey(actionId)]}
              busy={setLoadout.isPending || discardUnlock.isPending}
              onEquip={() => handleEquip(actionId)}
              onUnequip={() => handleUnequip(actionId)}
              onDiscard={() => requestDiscard(actionId)}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        open={pendingDiscardId !== null}
        title="Discard this action?"
        message={`Discarding "${pendingDiscardId ?? ""}" spends souls and cannot be undone this run.`}
        confirmLabel="Discard"
        tone="danger"
        busy={discardUnlock.isPending}
        onConfirm={confirmDiscard}
        onCancel={() => setPendingDiscardId(null)}
        testId="actions-tab-discard-confirm"
      />
    </div>
  );
}
