import type { ArmouryFilterState, ArmouryInboxView, ArmourySortKey, RenderStrategy } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { Badge, Checkbox, Select } from "@/ui";

/**
 * The loot filter and the inbox — the interface answer to review pressure.
 *
 * ⛔ **It is not a drop cap and it cannot become one.** Every control here narrows a view over rows
 * the server already sent; nothing throttles generation, and no combination of these settings can
 * reduce what a player owns. The list underneath stays complete.
 *
 * ⛔ **A locked row is never hidden.** That exemption lives in the predicate `ArmouryList` applies,
 * not in this component's copy, so it cannot be undone by changing a control here.
 *
 * ⚠ **Role and frame filtering is deliberately not offered.** Both live on the item's base type and
 * that table does not exist yet, so the rows come back without them. Filtering on the container's
 * slot instead would be a different axis and a plausible wrong answer.
 */

const SORT_OPTIONS: { id: ArmourySortKey; label: string }[] = [
  { id: "acquired", label: "Newest first" },
  { id: "rarity", label: "Rarest first" },
  { id: "unseen", label: "Unreviewed first" },
  { id: "locked", label: "Locked first" },
  { id: "assigned", label: "Equipped first" }
];

/**
 * The ten rungs, by ordinal — the same ladder the rows carry, offered as a floor and a ceiling
 * rather than as a single "hide below" so a player can also look at just the middle of their stock.
 */
const RARITY_BOUNDS: { ordinal: number; label: string }[] = [
  { ordinal: 10, label: "Chaff" },
  { ordinal: 20, label: "Sprout" },
  { ordinal: 30, label: "Grafted" },
  { ordinal: 40, label: "Cultivated" },
  { ordinal: 50, label: "Fused" },
  { ordinal: 60, label: "Chimeric" },
  { ordinal: 70, label: "Heirloom" },
  { ordinal: 80, label: "Firstseed" },
  { ordinal: 90, label: "Sunwoven" },
  { ordinal: 100, label: "Almanac" }
];

export const EMPTY_ARMOURY_FILTER: ArmouryFilterState = {
  rarityMin: null,
  rarityMax: null,
  unseenOnly: false,
  hideAssigned: false,
  hideStale: false,
  sort: "acquired"
};

function toOrdinal(raw: string): number | null {
  return raw === "" ? null : Number(raw);
}

export function ArmouryFilter({
  value,
  onChange,
  inbox,
  strategy,
  shownCount
}: {
  value: ArmouryFilterState;
  onChange: (next: ArmouryFilterState) => void;
  inbox: ArmouryInboxView;
  strategy: RenderStrategy;
  shownCount: number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3" data-testid="armoury-filter">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={inbox.overReviewPressure ? "warn" : "neutral"} data-testid="armoury-inbox">
          {formatMagnitude(inbox.unseen)} unreviewed
        </Badge>
        <span className="text-xs text-muted" data-testid="armoury-count">
          {formatMagnitude({ unit: "count", value: shownCount })} shown of {formatMagnitude(inbox.total)} held
        </span>
        {strategy !== "renderAll" ? (
          <span className="text-xs text-muted" data-testid="armoury-strategy">
            {strategy === "virtualize" ? "Scrolling a window" : "Narrow it to start"}
          </span>
        ) : null}
      </div>

      {inbox.overReviewPressure ? (
        <p className="text-xs text-warn" data-testid="armoury-review-pressure">
          More has piled up than most people read in one sitting. Nothing is hidden — this is just a nudge
          to empty the inbox.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-muted">
          At least
          <Select
            data-testid="armoury-rarity-min"
            value={value.rarityMin === null ? "" : String(value.rarityMin)}
            onChange={(e) => onChange({ ...value, rarityMin: toOrdinal(e.target.value) })}
          >
            <option value="">Any</option>
            {RARITY_BOUNDS.map((r) => (
              <option key={r.ordinal} value={r.ordinal}>
                {r.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col text-xs text-muted">
          At most
          <Select
            data-testid="armoury-rarity-max"
            value={value.rarityMax === null ? "" : String(value.rarityMax)}
            onChange={(e) => onChange({ ...value, rarityMax: toOrdinal(e.target.value) })}
          >
            <option value="">Any</option>
            {RARITY_BOUNDS.map((r) => (
              <option key={r.ordinal} value={r.ordinal}>
                {r.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col text-xs text-muted">
          Order
          <Select
            data-testid="armoury-sort"
            value={value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value as ArmourySortKey })}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Checkbox
          label="Unreviewed only"
          id="armoury-unseen-only"
          data-testid="armoury-unseen-only"
          checked={value.unseenOnly}
          onChange={(e) => onChange({ ...value, unseenOnly: e.target.checked })}
        />
        <Checkbox
          label="Hide equipped"
          id="armoury-hide-assigned"
          data-testid="armoury-hide-assigned"
          checked={value.hideAssigned}
          onChange={(e) => onChange({ ...value, hideAssigned: e.target.checked })}
        />
        <Checkbox
          label="Hide out of date"
          id="armoury-hide-stale"
          data-testid="armoury-hide-stale"
          checked={value.hideStale}
          onChange={(e) => onChange({ ...value, hideStale: e.target.checked })}
        />
      </div>

      <p className="text-2xs text-muted">Anything you have locked stays visible whatever you filter by.</p>
    </div>
  );
}
