import { useNavigate } from "react-router-dom";
import { useCommanders } from "@/lib/bus";
import { useDelveDomainOffersFull } from "@/lib/bus/delve";
import { ActorChip, type ActorRungState } from "@/ui/actor";
import { Banner, Button, Panel } from "@/ui";

const CREATURE_STRIP_MAX = 6;

/**
 * T26 (plate 01 §C): the composed Sanctum body once at least one creature is bound — everything
 * `FocusCard`'s own priority banner doesn't already cover. Only "The map table"'s sector-held count
 * is honestly `Pending` here (this plan's own resolved open question 2 — World/T16 is excluded this
 * phase, so a real number doesn't exist to show); everything else (the roster strip, the returned-
 * expedition prompt, the run CTA) is real, already-queried state, just not composed into one screen
 * until now.
 */
export function SanctumHome({
  playerId,
  actorStates,
  onOpenCreatures,
  onOpenCommanders,
  returnedExpeditionCount,
  onOpenExpeditions,
  onOpenDelvePicker
}: {
  playerId: number;
  actorStates: ActorRungState[];
  onOpenCreatures: () => void;
  onOpenCommanders: () => void;
  returnedExpeditionCount: number;
  onOpenExpeditions: () => void;
  /** D5.8 — opens `DelvePickerLayer` (`layers/delve/`). Only wired when the descent door is
   * unlocked; see this component's own "Descend" panel below for the lock gate itself. */
  onOpenDelvePicker: () => void;
}) {
  const navigate = useNavigate();
  const commandersQuery = useCommanders(playerId);
  // D5.8 (spec-delve-stage.md §4: "Locked until 'Delve — first domain found (expedition)' … shown
  // with what unlocks it, GG-17 — never invisible, never present-but-dead"). `GET
  // /api/delve/domains/{playerId}` (`DelveEndpoints.cs:49`) lists every domain the player has ever
  // found, sealed or not — a sealed or in-progress domain still counts as "found" — so a non-empty
  // response is the honest, already-real proxy for "at least one domain found," confirmed directly
  // against `HandleGetDomains`'s own implementation rather than assumed. Always `[]` in production
  // today (`dungeon_domain` has no write arm yet, D4.16), so this door is honestly always locked on a
  // live server right now — the same "provably correct, zero production trigger" posture the map
  // door (D1.28) already carries for the identical reason.
  const delveOffersQuery = useDelveDomainOffersFull(playerId);
  const hasFoundADomain = (delveOffersQuery.data?.length ?? 0) > 0;
  const defaultCommander =
    commandersQuery.data?.commanders.find((c) => c.isDefault) ??
    commandersQuery.data?.commanders.find((c) => c.id === commandersQuery.data?.defaultLawnCommanderId);
  const shown = actorStates.slice(0, CREATURE_STRIP_MAX);
  const overflow = actorStates.length - shown.length;

  return (
    <div className="mt-4 grid grid-cols-2 gap-4" data-testid="sanctum-home">
      <div className="flex flex-col gap-4">
        <Panel
          title="Your creatures"
          testId="sanctum-home-creature-strip"
          actions={
            <Button size="sm" variant="ghost" onClick={onOpenCreatures} data-testid="sanctum-home-all-creatures">
              All {actorStates.length}
            </Button>
          }
        >
          <div className="flex flex-wrap gap-2">
            {shown.map((s) => (s.kind === "ready" ? <ActorChip key={s.data.instanceId} state={s} /> : null))}
            {overflow > 0 ? (
              <span className="self-center text-xs text-muted" data-testid="sanctum-home-creature-overflow">
                and {overflow} more
              </span>
            ) : null}
          </div>
        </Panel>

        <Panel title="The map table" testId="sanctum-home-map-table">
          <p className="text-sm text-muted" data-testid="sanctum-home-sectors-held">
            Sectors held — not shown yet
          </p>
          <Button size="sm" className="mt-2" onClick={() => navigate("/world")} data-testid="sanctum-home-travel">
            Travel to the map
          </Button>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Tonight" testId="sanctum-home-tonight">
          {returnedExpeditionCount > 0 ? (
            <div className="flex items-center justify-between gap-2" data-testid="sanctum-home-tonight-expedition">
              <span className="text-sm text-text">
                {returnedExpeditionCount} expedition{returnedExpeditionCount === 1 ? "" : "s"} returned
              </span>
              <Button size="sm" onClick={onOpenExpeditions} data-testid="sanctum-home-tonight-collect">
                Collect
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted" data-testid="sanctum-home-tonight-empty">
              Nothing waiting tonight.
            </p>
          )}
        </Panel>

        <Panel title="Start a run" testId="sanctum-home-start-run">
          <Button className="w-full justify-between" onClick={() => navigate("/lawn")} data-testid="sanctum-home-defend">
            Defend the lawn
          </Button>
          {commandersQuery.isLoading ? (
            <p className="mt-2 text-xs text-muted" data-testid="sanctum-home-leading-loading">
              Loading commander…
            </p>
          ) : commandersQuery.isError ? (
            <Banner tone="error" className="mt-2" data-testid="sanctum-home-leading-error">
              Couldn&apos;t load who leads the next run.
              <Button size="sm" variant="ghost" className="ml-2" onClick={() => void commandersQuery.refetch()}>
                Retry
              </Button>
            </Banner>
          ) : defaultCommander ? (
            <div
              className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted"
              data-testid="sanctum-home-leading"
            >
              <span data-testid="sanctum-home-leading-line">
                Leading: {defaultCommander.displayName}
                {defaultCommander.activeAuraName ? ` · ${defaultCommander.activeAuraName}` : " · No aura"}
              </span>
              <Button size="sm" variant="ghost" onClick={onOpenCommanders} data-testid="sanctum-home-change-commander">
                Change commander
              </Button>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted" data-testid="sanctum-home-run-note">
            Uses whatever is already on the lawn.
          </p>
        </Panel>

        {/* D5.8 — the descent door, a Sanctum affordance (spec-delve-stage.md §4), never a rail entry
            and never a keybinding ("no rail row and no key"). Always rendered, locked or not — GG-17. */}
        <Panel title="Descend" testId="sanctum-home-delve-door">
          {hasFoundADomain ? (
            <>
              <p className="text-sm text-muted" data-testid="sanctum-home-delve-door-ready">
                A found domain is waiting.
              </p>
              <Button className="mt-2 w-full justify-between" onClick={onOpenDelvePicker} data-testid="sanctum-home-delve-door-open">
                Open the descent door
              </Button>
            </>
          ) : (
            <>
              <Button
                className="mt-0 w-full justify-between"
                disabled
                title="Unlocks once an expedition finds your first domain."
                data-testid="sanctum-home-delve-door-locked"
              >
                Open the descent door
              </Button>
              <p className="mt-2 text-xs text-muted" data-testid="sanctum-home-delve-door-locked-reason">
                Unlocks once an expedition finds your first domain.
              </p>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
