import type { ForceView, SectorView, SlotView, VaultView } from "@/contract/types";
import { DockShell } from "@/shell/DockShell";
import { BLOCK_ORDER } from "./blockOrder";
import { IdentityHeader } from "./IdentityHeader";
import { GroundBlock } from "./GroundBlock";
import { NextTurnBlock, type NextTurnPin } from "./NextTurnBlock";
import { SectorLoamBlock } from "./SectorLoamBlock";
import { ComponentBlock } from "./ComponentBlock";
import { SlotRow } from "./SlotRow";
import { WonderSectorCard } from "../wonderDisplay/WonderSectorCard";
import { shouldMountWonderCard } from "../wonderDisplay/wonderDisplayFold";
import type { WonderCatalogRow } from "../wonderDisplay/wonderDisplayFold";
import { ForceRow } from "./ForceRow";
import { VaultBlock, type VaultBlockState } from "./VaultBlock";
import { WardenBlock } from "./WardenBlock";
import { DowseBlock } from "./DowseBlock";
import { ActionCluster, type ActionVerb } from "./ActionCluster";

export type SectorInspectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sector: SectorView;
  slots: SlotView[];
  forces: ForceView[];
  /** `spec-world-inspector.md` §3: until `world-commands` ships the `cede` order kind, the pin's
   * own controls do not render at all — the forecast sentence still does, truthfully. */
  cedeOrderAvailable: boolean;
  onPin?: (pin: NextTurnPin) => void;
  /** Not a `SectorView` field — `Prospecting.Reveal` is a world-scope list
   * (`WorldStateDto.ProspectedSectorIds`), so the caller checks membership once and passes the
   * per-sector answer down. */
  prospected: boolean;
  /**
   * party-dungeon D1.28 (the world-map door) — the ONE verb `world-inspector` owns so far. Computed
   * by the caller (`WorldStage.tsx`), never here: this component stays pure/presentational (no
   * hooks), exactly as it already was, so `SectorInspector.test.tsx`'s existing renders need no
   * `QueryClientProvider` wrapping to keep passing. `null`/`undefined` when this sector has none of
   * the four reused slot kinds (`delveDoorCapability.ts`'s own structural gate) — the actions region
   * stays empty in that case, same as every sector before this task.
   */
  delveDoorVerb?: ActionVerb | null;
  /**
   * empire-inventory-surfaces `storage-cache-ui` §Design 1 (plan Task 4D.2a) — the vault block's
   * one-sector read plus its action-row verbs. Computed by the caller (`WorldStage.tsx`), never
   * here: this component stays pure/presentational (no hooks), exactly the `delveDoorVerb`
   * precedent above. `vaultVerbs` are the put-in / take-out pair filing 4A.1's
   * `deposit-cargo` / `withdraw-cargo` kinds; they join the SAME generic `ActionCluster`
   * (never a second cluster, never per-row buttons in the block — the block takes no order).
   */
  vault?: VaultView | null;
  vaultState?: VaultBlockState;
  vaultError?: string | null;
  onVaultRetry?: () => void;
  vaultVerbs?: ActionVerb[] | null;
  /**
   * empire-wonder-surfaces `wonder-display` §Design 1 (plan Task 4D.4) — the world-catalog rows
   * (`GET /api/world/catalog` structures: `WorldStructureDto` satisfies this structurally) for
   * the slots below. Optional and append-only: absent reads exactly as before (Wonder slots mount
   * the card with pending cap lines — the designed pre-wire reading, never a guessed number).
   * The `WorldStage` wiring (`catalogStructures={catalog.data?.structures ?? null}` beside this
   * dock) is deferred past the map-FE freeze, exactly per the 4D.1 integrator-note precedent —
   * until then the card binds the live 4A.4 slot/sector fields and pends the cap denominator.
   */
  catalogStructures?: WonderCatalogRow[] | null;
};

/**
 * The ten blocks plus the action cluster (world-stage W57 owned the first nine;
 * empire-inventory-surfaces 4D.2a added the vault block between forces and warden), in the plate's own order
 * (`spec-world-inspector.md` §2) — the dock plus the layout the GG-61 proof needs. **The shell and
 * the order were W57's own job**; all nine blocks are now their own real, separately-tested
 * components per the spec's own project-structure list (`IdentityHeader`/`GroundBlock` W58,
 * `NextTurnBlock` W59, `SectorLoamBlock`/`ComponentBlock` W61, `SlotRow`/`ForceRow` W62,
 * `WardenBlock`/`DowseBlock` W63) — the Actions region stays inline, reserved, pending W64's own full
 * roster (Claim/Build/Cede/etc). party-dungeon D1.28 (2026-09-07) put exactly one verb into it ahead
 * of W64 — the map-door row, the freeze's own named exception (`world-stage-map.md:262-266`,
 * decision 2) — via the SAME generic `ActionCluster` W64 will otherwise use; still empty for any
 * sector without one of the four reused slot kinds.
 *
 * **One real gap remains, stated honestly rather than invented around:** `Dowsing` (block 9) is not
 * a per-sector wire field (`Prospecting.Reveal` is world-scoped, `WorldStateDto.ProspectedSectorIds`);
 * the caller answers it once via `prospected`. `Pressure` (block 2) was *thought* to be a second
 * gap — this task's own earlier description claimed `WorldSectorDto.PressureMilli` was "declared
 * and never assigned" — but W63 found that stale too: `LoamPhases.NextPressure` writes it every
 * turn from fade contagion, real state that simply never reached this view contract; fixed at the
 * adapter, `GroundBlock` now renders it for real.
 */
export function SectorInspector({
  open,
  onOpenChange,
  sector,
  slots,
  forces,
  cedeOrderAvailable,
  onPin,
  prospected,
  delveDoorVerb,
  vault,
  vaultState,
  vaultError,
  onVaultRetry,
  vaultVerbs,
  catalogStructures
}: SectorInspectorProps) {
  const verbs = [...(delveDoorVerb ? [delveDoorVerb] : []), ...(vaultVerbs ?? [])];
  return (
    <DockShell open={open} onOpenChange={onOpenChange} title={sector.sectorId} testId="sector-inspector">
      <div className="flex flex-col gap-4" data-testid="sector-inspector-blocks" data-block-order={BLOCK_ORDER.join(",")}>
        <section data-testid="inspector-block-identity">
          <IdentityHeader sector={sector} />
        </section>

        <section data-testid="inspector-block-ground">
          <GroundBlock sector={sector} />
        </section>

        <section data-testid="inspector-block-next-turn">
          <NextTurnBlock sector={sector} cedeOrderAvailable={cedeOrderAvailable} onPin={onPin} />
        </section>

        <section data-testid="inspector-block-sector-loam">
          <SectorLoamBlock sector={sector} />
        </section>

        <section data-testid="inspector-block-territory">
          <ComponentBlock sector={sector} />
        </section>

        <section data-testid="inspector-block-slots">
          <h4 className="mb-1 font-display text-sm text-text">Slots</h4>
          <ul className="flex flex-col gap-1">
            {slots.map((slot) => {
              // wonder-display 4D.4: Wonder slots mount the authored card (identity + effect +
              // progress) instead of the legacy raw-id sentence; every other slot is untouched.
              const catalogRow = catalogStructures?.find((c) => c.structureId === slot.structureId) ?? null;
              const catalogProvided = catalogStructures != null;
              if (shouldMountWonderCard({ slot, sector, catalogRow, catalogProvided })) {
                return (
                  <WonderSectorCard
                    key={slot.slotIndex}
                    slot={slot}
                    sector={sector}
                    catalogRow={catalogRow}
                    catalogProvided={catalogProvided}
                  />
                );
              }
              return <SlotRow key={slot.slotIndex} slot={slot} forces={forces} />;
            })}
          </ul>
        </section>

        <section data-testid="inspector-block-forces">
          <h4 className="mb-1 font-display text-sm text-text">Forces</h4>
          <ul className="flex flex-col gap-1">
            {forces.map((force) => (
              <ForceRow key={force.entityId} force={force} />
            ))}
          </ul>
        </section>

        <section data-testid="inspector-block-vault">
          <VaultBlock
            vault={vault ?? null}
            state={vaultState ?? "loading"}
            error={vaultError}
            onRetry={onVaultRetry}
          />
        </section>

        <section data-testid="inspector-block-warden">
          <WardenBlock sector={sector} />
        </section>

        <section data-testid="inspector-block-dowsing">
          <DowseBlock prospected={prospected} />
        </section>

        <section data-testid="inspector-actions">
          {verbs.length > 0 ? <ActionCluster verbs={verbs} /> : null}
        </section>
      </div>
    </DockShell>
  );
}

export { BLOCK_ORDER };
