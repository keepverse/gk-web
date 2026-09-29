import type { PartyView } from "@/contract/types";
import { partyBannerLabel } from "@/stages/delve/labels";
import { formatMagnitude } from "@/i18n/magnitude";
import { MemberRow } from "./MemberRow";

/**
 * All raid parties, by name (D5.6, spec-delve-stage.md §7's HUD row: "Party strip (parties by name)
 * ... haul and unclaimed souls"; §8 row 4: `PartyIndex` "never rendered" — four fixed names from
 * `labels.ts`, D5.10's own `partyBannerLabel`). `soulsUnbanked` (the "unclaimed souls" half of that
 * row) is delve-wide, not per-party — rendered once, in `DelveHud`'s own top strip, not duplicated
 * here per party.
 *
 * Keyed by `entityId` (the party's own stable identity), never `partyIndex` — an index is fine as a
 * *label input* (`partyBannerLabel` takes it on purpose) but wrong as a React `key`, for the same
 * "never render or key off the position" reasoning `PartyView`'s own doc comment gives for the
 * position/entityId join in `adaptDelve`.
 */
export function PartyRail({ parties }: { parties: PartyView[] }) {
  return (
    <ul className="flex flex-col gap-2" data-testid="delve-party-rail">
      {parties.map((party) => (
        <li
          key={party.entityId}
          data-testid={`delve-party-banner-${party.entityId}`}
          className="rounded border border-border bg-panel p-2"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className="font-display text-sm text-text"
              data-testid={`delve-party-banner-name-${party.entityId}`}
            >
              {partyBannerLabel(party.partyIndex)}
            </span>
            <span className="text-2xs text-muted" data-testid={`delve-party-haul-${party.entityId}`}>
              {party.haul.length > 0
                ? `${formatMagnitude({ unit: "count", value: party.haul.length })} to carry out`
                : "Nothing to carry yet"}
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {party.members.map((member) => (
              <MemberRow key={member.instanceId} member={member} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
