import { formatMagnitude } from "@/i18n/magnitude";
import { componentSplitFor, type ComponentSplitInput } from "./componentSplitMath";

export type ComponentSplitProps = {
  components: readonly ComponentSplitInput[];
};

/**
 * The component-split row (world-stage W54) — band 1's place for *"my empire is fine can be false
 * while half of it starves."* One component collapses this entirely (nothing renders); no territory
 * renders a sentence, never four zeroes (a zero reads as a broken feed, not an honest empty state).
 *
 * **Four channels, colour fourth:** a starving row carries a glyph (▲, aria-hidden), its own word
 * ("can't cover its own keep" — never shared with the split-but-solvent sentence), a bold border
 * weight, and only then the tint; strip every colour and the other three still say which row is the
 * alarm.
 */
export function ComponentSplit({ components }: ComponentSplitProps) {
  const view = componentSplitFor(components);

  if (view.kind === "no-territory") {
    return (
      <p data-testid="component-split-empty" className="text-sm text-muted">
        No territory of your own to draw on yet.
      </p>
    );
  }

  if (view.kind === "collapsed") {
    return null;
  }

  return (
    <div data-testid="component-split" className="flex flex-col gap-1 text-sm">
      <p data-testid="component-split-summary" className="text-muted">
        Your supply is split into {components.length} part{components.length === 1 ? "" : "s"}.
      </p>
      <ul className="flex flex-col gap-1">
        {view.rows.map((row) => (
          <li
            key={row.componentId}
            data-testid={`component-split-row-${row.componentId}`}
            data-state={row.state}
            className={
              row.state === "starving"
                ? "flex items-center justify-between gap-2 rounded-sm border-2 border-bad-solid bg-bad/10 px-2 py-1 text-bad"
                : "flex items-center justify-between gap-2 rounded-sm border border-border px-2 py-1 text-text"
            }
          >
            <span>
              {row.sectorCount} sector{row.sectorCount === 1 ? "" : "s"}
            </span>
            {row.state === "starving" ? (
              <span data-testid={`component-split-alarm-${row.componentId}`}>
                <span aria-hidden="true">▲</span> can&apos;t cover its own keep
              </span>
            ) : (
              <span>{formatMagnitude(row.net)} loam / turn</span>
            )}
          </li>
        ))}
      </ul>
      {view.foldedSolventCount > 0 ? (
        <p data-testid="component-split-folded" className="text-muted">
          +{view.foldedSolventCount} more, self-sufficient
        </p>
      ) : null}
    </div>
  );
}
