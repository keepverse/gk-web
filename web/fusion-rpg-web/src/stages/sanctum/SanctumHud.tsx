import type { Pending } from "@/contract/pending";

/**
 * Band-1. "Summoner level + XP · soul balance · unread results · the layer
 * rail" (information-architecture.md §2.1). Deliberately carries none of
 * HudBar.tsx's dev-facing fields (API address, injector dot) — those stay
 * on the pages that haven't migrated yet, not because they're wrong there,
 * but because a player-facing HUD is a different contract (web/spec.md §9).
 */
export function SanctumHud({
  playerName,
  soulsBalance,
  summonerLevel,
  unreadResultCount,
  onOpenSystem
}: {
  playerName: string;
  soulsBalance: number;
  summonerLevel: Pending<{ level: number; xp: number }>;
  unreadResultCount: number;
  onOpenSystem: () => void;
}) {
  return (
    <div className="band-hud flex items-center gap-5 border-b border-border bg-soil-raised px-5 py-3" data-testid="sanctum-hud">
      <h1 className="font-display text-lg text-text" data-testid="sanctum-hud-identity">
        {playerName}
      </h1>

      <span className="flex items-center gap-1 text-sm text-sun" data-testid="sanctum-hud-souls">
        <span aria-hidden="true">✦</span>
        {soulsBalance.toLocaleString()}
      </span>

      {summonerLevel.state === "known" ? (
        <span className="text-sm text-muted" data-testid="sanctum-hud-level">
          Lv {summonerLevel.value.level} · {summonerLevel.value.xp} xp
        </span>
      ) : (
        <span className="text-xs italic text-muted" data-testid="sanctum-hud-level-pending">
          {summonerLevel.state === "pending" ? summonerLevel.reason : "No summoner level yet"}
        </span>
      )}

      {unreadResultCount > 0 ? (
        <span
          className="rounded-pill bg-bad-solid px-2 py-0.5 text-xs text-text"
          data-testid="sanctum-hud-unread"
        >
          {unreadResultCount} unread
        </span>
      ) : null}

      <span className="flex-1" />

      <button
        type="button"
        data-testid="sanctum-hud-menu"
        onClick={onOpenSystem}
        title="Settings"
        className="rounded-sm border border-border-control px-2.5 py-1.5 text-sm text-muted hover:bg-panel-raised hover:text-text"
      >
        Menu
      </button>
    </div>
  );
}
