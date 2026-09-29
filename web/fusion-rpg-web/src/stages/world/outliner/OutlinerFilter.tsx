import type { OutlinerFilter } from "./outlinerModel";

export type OutlinerFilterProps = {
  filter: OutlinerFilter;
  onChange: (filter: OutlinerFilter) => void;
};

const CHIPS: readonly { value: OutlinerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs-orders", label: "Needs orders" },
  { value: "fading", label: "Fading" }
];

/**
 * world-stage W91 (spec-world-outliner.md) — three exclusive filter chips: at 28 rows the player
 * knows the condition, not the name. A radio group, not independent toggles — exactly one is active.
 * The active chip is stated in words (`aria-checked`, read by its own accessible name), never by
 * fill alone.
 */
export function OutlinerFilter({ filter, onChange }: OutlinerFilterProps) {
  return (
    <div role="radiogroup" aria-label="Filter the outliner" data-testid="outliner-filter">
      {CHIPS.map((chip) => (
        <button
          key={chip.value}
          type="button"
          role="radio"
          aria-checked={filter === chip.value}
          data-testid={`outliner-filter-${chip.value}`}
          onClick={() => onChange(chip.value)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
