import { describePlaybackEntry } from "@/stages/world/playbackTable";

/**
 * The action cluster's own refusal reasons (world-stage W64) read through the exact same one table
 * `world-playback` built for turn-report drop reasons (W72) — `describePlaybackEntry`'s
 * `"command.dropped"` category is the single source both surfaces share, never a second copy. A
 * raw engine reason like `"claim.contested"` or `"build.cannot-afford"` becomes real player text;
 * an admission reason this table was never updated for still degrades honestly (loud in
 * development, a neutral sentence in production) rather than leaking the token.
 */
export function reasonFor(reason: string): string {
  return describePlaybackEntry({ kind: "command.dropped", subject: "", detail: reason, sectorId: null });
}
