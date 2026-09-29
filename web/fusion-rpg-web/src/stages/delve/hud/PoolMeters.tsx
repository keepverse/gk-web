import type { Magnitude, ResourceId } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { formatMagnitude } from "@/i18n/magnitude";

/**
 * The six real resource-pool ids, in `DerivedStatChannels.ResourceIds`'s own fixed order
 * (`gk-core/src/FusionRpg.Core/Stats/Derived/DerivedStatChannels.cs:521`: "hp, stamina, hunger, spirit, qi,
 * poise" — `poise` appended 2026-08-26, class-system, append-only). No FE-side export of this list
 * exists yet (confirmed by grep across `gk-web/web/fusion-rpg-web/src`), so this is a client-side mirror of
 * the C# SSOT, the same posture `labels.ts`'s own id tables already take for other closed, server-owned
 * vocabularies. `MemberView.pools`'s own doc comment: "keyed by the six resource ids (resource-hub:
 * hp/stamina/hunger/spirit/qi/poise)".
 */
const POOL_IDS = ["hp", "stamina", "hunger", "spirit", "qi", "poise"] as const;

/**
 * Plain, generic English labels — not the faction-resolved wording `ResourceView.label`'s own doc
 * comment describes ("hunger -> Sun/Hunger, qi -> Yang/Yin"). That resolution needs a faction id, and
 * neither `MemberView` nor `PartyView` carries one (confirmed by reading both in full) — delve is the
 * first player surface to show these six per-member at all, so there is no existing convention to
 * match here either way. A named, honest simplification, not a guess at the missing faction wiring.
 */
const POOL_LABELS: Record<(typeof POOL_IDS)[number], string> = {
  hp: "HP",
  stamina: "Stamina",
  hunger: "Hunger",
  spirit: "Spirit",
  qi: "Qi",
  poise: "Poise"
};

export type PoolMetersProps = {
  /** `MemberView.pools` — current values, real, always known (never `Pending`). */
  pools: Record<ResourceId, Magnitude>;
  /**
   * `MemberView.poolFill` — real on the contract, but `adaptDelveMember` always returns
   * `pendingWithReason(...)` today (confirmed by reading `contract/adapt.ts` directly: no caller
   * anywhere ever produces a `known` one) because no live read joins a member's derived channel sheet
   * onto a delve read yet. This component renders both states honestly rather than assuming either.
   *
   * Deliberately does **not** also take `MemberView.poolMax`: this component never computes a fill
   * ratio itself from `current / max` (that would be exactly the client-side arithmetic on a figure
   * §16 forbids — two separately-real server figures combined into a third the server never sent). The
   * bar reads `poolFill` directly, already a `perMilleRatio` Magnitude, the same "render the given
   * figure, never derive a new one" rule `ExtractionView`'s own doc comment states for kills/victory.
   */
  poolFill: Pending<Record<ResourceId, Magnitude>>;
};

/** One member's six pool meters (D5.6, spec-delve-stage.md §6/§7: "Six pool meters ... per member",
 * `count` for the current value, `perMilleRatio`/`flat` for the fill). */
export function PoolMeters({ pools, poolFill }: PoolMetersProps) {
  const knownFill = poolFill.state === "known" ? poolFill.value : null;

  return (
    <div data-testid="delve-pool-meters">
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {POOL_IDS.map((id) => {
          const current = pools[id];
          const fill = knownFill?.[id];
          return (
            <li key={id} data-testid={`delve-pool-meter-${id}`} className="text-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">{POOL_LABELS[id]}</span>
                <span data-testid={`delve-pool-value-${id}`}>
                  {current != null ? formatMagnitude(current) : "—"}
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-pill bg-soil"
                data-testid={`delve-pool-bar-track-${id}`}
              >
                {fill != null ? (
                  <div
                    className="h-full rounded-pill bg-ok"
                    style={{ width: `${Math.max(0, Math.min(1000, fill.value)) / 10}%` }}
                    data-testid={`delve-pool-bar-fill-${id}`}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {poolFill.state === "pending" ? (
        <p className="mt-1 text-2xs italic text-muted" data-testid="delve-pool-fill-pending">
          {poolFill.reason}
        </p>
      ) : null}
    </div>
  );
}
