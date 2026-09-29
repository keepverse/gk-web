import type { DerivedContribution } from "@/contract/types";

/**
 * aura-skill T18c: GG-49, non-vacuously for the first time — "why did my attack drop?" answered
 * with each source that touched a derived channel (`DerivedContributionBag`, T11, served by
 * `AuraDerivedEndpoints.cs`, T18b). Never a fabricated grid: an empty list here means the channel
 * genuinely had no contributor (a registered channel nothing wrote to), not a loading state — the
 * caller decides whether that is worth rendering at all.
 */
export function ChannelContributions({ contributions }: { contributions: DerivedContribution[] }) {
  if (contributions.length === 0) {
    return (
      <p className="text-2xs italic text-muted" data-testid="channel-contributions-empty">
        No source has contributed to this channel yet.
      </p>
    );
  }

  return (
    <ul className="mt-1 space-y-0.5" data-testid="channel-contributions">
      {contributions.map((c, i) => (
        <li
          key={`${c.sourceId}-${i}`}
          className="flex items-center justify-between text-2xs text-muted"
          data-testid={`channel-contribution-${c.sourceId}`}
        >
          <span>{c.sourceId}</span>
          <span className="font-mono text-text">
            {c.value >= 0 ? "+" : ""}
            {c.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
