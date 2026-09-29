import { cn } from "@/lib/cn";
import type { RailEntry } from "./railState";

// Glyph per entry — plate 01 §C / 02 §A / 04 §A draw the rail as an icon-over-label dock, not a
// text-only strip. Kept local to this component (not threaded through `RailEntry`) so `railState.ts`
// stays purely about unlock derivation, not presentation.
const RAIL_ICON: Record<RailEntry["id"], string> = {
  sanctum: "⌂",
  creatures: "✦",
  commanders: "♔",
  relics: "◈",
  fusion: "⚗",
  pacts: "👹",
  expeditions: "⛵",
  almanac: "📖",
  chronicle: "🕮"
};

/**
 * Band-1 (HUD). Identical on every stage (information-architecture.md §3) —
 * this component doesn't know which stage it's on beyond what `entries`
 * (already derived by `deriveRailEntries`) tells it. T25: a vertical,
 * left-docked icon column (plate 01 §C / 02 §A / 04 §A), not the earlier
 * horizontal strip — a caller docks it beside its body content (see
 * `SanctumStage.tsx`'s `sanctum-frame` row); this component only owns its
 * own column layout, never its placement in a page.
 */
export function Rail({ entries, onSelect }: { entries: RailEntry[]; onSelect: (id: RailEntry["id"]) => void }) {
  return (
    <nav
      className="band-hud flex w-[92px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-soil-raised p-2"
      data-testid="rail"
      aria-label="Layers"
    >
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          data-testid={`rail-${entry.id}`}
          data-state={entry.state}
          disabled={entry.state === "locked"}
          title={entry.state === "locked" ? entry.lockedReason : entry.label}
          onClick={() => entry.state !== "locked" && onSelect(entry.id)}
          className={cn(
            "relative grid h-[50px] shrink-0 place-items-center gap-0.5 rounded-sm border px-1 text-center transition-colors",
            entry.state === "active" && "border-lawn-hot bg-lawn text-text",
            entry.state === "available" && "border-transparent text-muted hover:bg-panel hover:text-text",
            entry.state === "badged" && "border-transparent text-text",
            entry.state === "locked" && "cursor-not-allowed border-transparent text-faint opacity-60"
          )}
        >
          {/* Font-size/weight utilities go on these spans, not the button — tokens.css's unlayered
              `button, input, select { font: inherit }` reset always wins over a layered Tailwind
              utility applied straight to a <button>, so a size class placed there is silently a
              no-op (found via T25's own live screenshot: labels rendered at the root 14px and
              truncated instead of the plate's small icon-over-label dock). */}
          <span aria-hidden="true" className="text-lg leading-none">
            {RAIL_ICON[entry.id]}
          </span>
          <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-2xs font-extrabold leading-none tracking-wide">
            {entry.label}
          </span>
          {entry.state === "locked" ? (
            <span aria-hidden="true" className="absolute right-1 top-1 text-2xs">
              🔒
            </span>
          ) : null}
          {entry.state === "badged" && entry.badgeCount ? (
            <span
              data-testid={`rail-${entry.id}-badge`}
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-bad-solid px-1 text-2xs text-text"
            >
              {entry.badgeCount}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
