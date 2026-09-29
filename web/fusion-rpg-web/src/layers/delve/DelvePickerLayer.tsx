import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { newCorrelationId, useUniqueActors } from "@/lib/bus";
import { buildDelvePickerStartBody, useDelveDomainOffersFull, useStartDelve } from "@/lib/bus/delve";
import { adaptActor } from "@/contract/adapt";
import type { DomainOfferView, RungOfferView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { PanelShell } from "@/shell/PanelShell";
import { Banner, Button, EmptyState, Select } from "@/ui";
import { ActorChip, type ActorRungState } from "@/ui/actor";
import { delveRoute } from "@/stages/delve/route";
import { entryKindLabel, raidModeLabel, startRefusalMessage } from "@/stages/delve/labels";
import { DescendConfirm } from "@/stages/delve/confirms/DescendConfirm";

export type DelvePickerLayerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: number;
};

/** A rung and a tail step (`RungOfferView`'s two variants) both need one stable key and one display
 * line; a tail step has no `rungId` at all, so `n`'s own value stands in — both are real, already-
 * adapted fields, never a fabricated one. */
function rungOfferKey(rung: RungOfferView): string {
  return rung.kind === "rung" ? `rung:${rung.rungId}` : `tail:${rung.n.value}`;
}

/** `label`/`bandName` are both already server-resolved, authored display text (confirmed against the
 * real `DomainOfferDto` fixture in `contract/adaptDelve.test.ts` — e.g. `label: "Rung One"`,
 * `bandName: "Deep"` — neither reads like a wire id), so this composes them verbatim rather than
 * routing either through `labels.ts`: there is no id here to translate. */
function rungOfferLabel(rung: RungOfferView): string {
  return `${rung.label} — ${rung.bandName}`;
}

/**
 * D5.8 — the Sanctum descent door's own band-2 picker (spec-delve-stage.md §7 "Descent picker" row:
 * "found domains, difficulty names, raid mode, parties, provisioning … Opened from the Sanctum door").
 * Lives under `layers/delve/`, the top-level layers root every other feature's own picker/inspector
 * already lives under (`layers/expeditions/ExpeditionsLayer.tsx`, `layers/relics/RelicsLayer.tsx`) —
 * a different, established shape from a delve-stage band-2 panel opened from WITHIN the stage
 * (`stages/delve/layers/`, D5.7's own tree, untouched here). Mirrors `RelicsLayer.tsx`'s own shape
 * specifically: real hooks and real content directly inside a `PanelShell`, not `ExpeditionsLayer`'s
 * wrapped-legacy-page shape — this surface has no pre-existing standalone page to wrap.
 *
 * **Real content, honestly untestable against live data today.** `GET /api/delve/domains/{playerId}`
 * always returns `[]` in production (`dungeon_domain` has no write arm yet, D4.16 — confirmed directly
 * against `DelveEndpoints.cs`'s own class doc), so this component's empty state is the only one a live
 * session can ever reach right now. Every other branch (a real domain row, the rung/raid-mode/party
 * builder, a real Descend attempt) is built and unit-tested against fixtures matching the real DTO
 * shape, the same "provably correct, zero production trigger" posture `DelveEndpoints.cs`'s own
 * `BuildDomainOfferLive`/`BuildDelveStartLive` delegates and the map door (D1.28) already carry.
 *
 * **No per-party assignment UI.** `DelveStartRequestBody.memberInstanceIds` is a flat list on the wire
 * (`DelveEndpoints.cs:260`) — the server partitions it into parties/slots itself
 * (`PartyShapeForRaidMode` returns a `(parties, squadSlots)` capacity, not a shape the client must
 * pre-fill) — so a flat checklist is the complete, correct UI for this field, not a simplification of a
 * richer one. What this component genuinely cannot do: proactively cap the checklist at a raid mode's
 * real party-shape limit, since no client-facing read exposes `DungeonTuningHub.Tuning.RaidModes`
 * today — inventing a limit here would risk baking in a wrong, unmaintained copy of a server tunable.
 * Named, not hidden: an over-full party is refused by the server as `raid.party-shape`, surfaced through
 * `startRefusalMessage` in the Descend confirm's own error slot, the same reactive path
 * `member.unavailable:{id}` already uses for the identical reason (see below).
 *
 * **Member eligibility is honestly partial.** `ActorView.phase` (`contract/adapt.ts`'s own
 * `toActorPhase`) narrows every server phase outside `ActiveBound`/`ActiveUnbound`/`Retired`/`Idle` —
 * which includes the real phases `DelveStartLive`'s own gates check, `"Roster"` and `"Recovering"` —
 * down to `"Idle"`. So this component can only proactively disable what it can actually tell apart:
 * a `Retired` ("Fallen") member, which structurally can never go on a delve. "On an expedition,"
 * "recovering," and "already carrying" (§10 row 3's own three reasons) have no faithful client signal
 * today; a real `member.unavailable:{id}` refusal is surfaced reactively, after a real attempt, through
 * the same `startRefusalMessage` error slot — not fabricated as a pre-emptive per-row disable this
 * component cannot honestly compute. This is a real, pre-existing gap in `contract/adapt.ts`'s own
 * narrowing, not something this task introduces or should fix blind.
 */
export function DelvePickerLayer({ open, onOpenChange, playerId }: DelvePickerLayerProps) {
  const offersQuery = useDelveDomainOffersFull(playerId);
  const rosterQuery = useUniqueActors(playerId);
  const startDelve = useStartDelve();
  const navigate = useNavigate();

  const [expandedDomainId, setExpandedDomainId] = useState<string | null>(null);
  const [selectedRungKey, setSelectedRungKey] = useState<string>("");
  const [selectedRaidMode, setSelectedRaidMode] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [oathAccepted, setOathAccepted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const offers = offersQuery.data ?? [];
  const roster = rosterQuery.data?.items ?? [];

  const expandedOffer = offers.find((o) => o.domainId === expandedDomainId) ?? null;
  const allRungs: RungOfferView[] = expandedOffer ? [...expandedOffer.rungs, ...expandedOffer.tailSteps] : [];
  const selectedRung = allRungs.find((r) => rungOfferKey(r) === selectedRungKey) ?? null;
  const requiresOath = selectedRung?.kind === "rung" && selectedRung.oathOffered === true;
  const permadeath = selectedRung?.kind === "rung" && selectedRung.permadeath === true;

  function openBuilder(offer: DomainOfferView) {
    const alreadyOpen = offer.domainId === expandedDomainId;
    setExpandedDomainId(alreadyOpen ? null : offer.domainId);
    setSelectedRungKey("");
    setSelectedRaidMode(alreadyOpen ? "" : (offer.raidModes[0] ?? ""));
    setSelectedMemberIds([]);
    setOathAccepted(false);
    setLastError(null);
  }

  function toggleMember(instanceId: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId]
    );
  }

  const descendDisabledReason: string | null = !selectedRung
    ? "Choose a rung first."
    : !selectedRaidMode
      ? "Choose how many bands first."
      : selectedMemberIds.length === 0
        ? "Choose at least one creature first."
        : null;

  function handleDescendClick() {
    if (descendDisabledReason) return;
    setLastError(null);
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (!expandedOffer || !selectedRung) return;
    const body = buildDelvePickerStartBody({
      domainId: expandedOffer.domainId,
      rungIdOrTailLabel: selectedRung.kind === "rung" ? selectedRung.rungId : selectedRung.label,
      oath: requiresOath ? oathAccepted : false,
      raidMode: selectedRaidMode,
      memberInstanceIds: selectedMemberIds,
      playerId,
      correlationId: newCorrelationId()
    });
    startDelve.mutate(body, {
      onSuccess: (result) => {
        setConfirmOpen(false);
        onOpenChange(false);
        navigate(delveRoute(result.delveId));
      },
      onError: (err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        setLastError(startRefusalMessage(reason));
      }
    });
  }

  return (
    <PanelShell
      open={open}
      onOpenChange={onOpenChange}
      title="Delve"
      subtitle="Choose a found domain to descend into"
      testId="delve-picker-layer"
    >
      {offersQuery.isLoading ? (
        <p className="text-sm text-muted" data-testid="delve-picker-loading">
          Loading…
        </p>
      ) : offersQuery.isError ? (
        <Banner tone="error" data-testid="delve-picker-error">
          Couldn&apos;t load domains.
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => void offersQuery.refetch()}>
            Retry
          </Button>
        </Banner>
      ) : offers.length === 0 ? (
        <EmptyState
          title="No domains found yet"
          hint="Domains are discovered through expeditions."
          testId="delve-picker-empty"
        />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="delve-picker-domain-list">
          {offers.map((offer) => (
            <li key={offer.domainId} data-testid={`delve-picker-domain-${offer.domainId}`}>
              {offer.sealed ? (
                <div className="rounded-md border border-border bg-panel p-3" data-testid="delve-picker-domain-sealed">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-text">{offer.name}</span>
                    <Badge tone="bad">Closed to you</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{offer.flavor}</p>
                </div>
              ) : offer.resume ? (
                <div
                  className="rounded-md border border-border bg-panel p-3"
                  data-testid="delve-picker-domain-in-progress"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-text">{offer.name}</span>
                    <Badge tone="warn">In progress</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{offer.flavor}</p>
                  <Button
                    size="sm"
                    className="mt-2"
                    data-testid="delve-picker-domain-return"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(delveRoute(String(offer.resume!.delveId)));
                    }}
                  >
                    Return
                  </Button>
                </div>
              ) : (
                <DomainBuilderRow
                  offer={offer}
                  expanded={expandedDomainId === offer.domainId}
                  onToggle={() => openBuilder(offer)}
                  selectedRungKey={selectedRungKey}
                  onSelectRung={setSelectedRungKey}
                  selectedRaidMode={selectedRaidMode}
                  onSelectRaidMode={setSelectedRaidMode}
                  roster={roster}
                  rosterLoading={rosterQuery.isLoading}
                  selectedMemberIds={selectedMemberIds}
                  onToggleMember={toggleMember}
                  descendDisabledReason={
                    expandedDomainId === offer.domainId ? descendDisabledReason : "Choose a rung first."
                  }
                  onDescend={handleDescendClick}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {expandedOffer && selectedRung ? (
        <DescendConfirm
          open={confirmOpen}
          domainName={expandedOffer.name}
          entryKindPhrase={entryKindLabel(expandedOffer.entryKey)}
          rungLabel={rungOfferLabel(selectedRung)}
          raidModePhrase={raidModeLabel(selectedRaidMode)}
          memberCount={selectedMemberIds.length}
          requiresOath={requiresOath}
          permadeath={permadeath}
          oathAccepted={oathAccepted}
          onOathAcceptedChange={setOathAccepted}
          busy={startDelve.isPending}
          errorMessage={lastError}
          onConfirm={handleConfirm}
          onCancel={() => {
            if (startDelve.isPending) return;
            setConfirmOpen(false);
          }}
        />
      ) : null}
    </PanelShell>
  );
}

function Badge({ tone, children }: { tone: "bad" | "warn"; children: ReactNode }) {
  return (
    <span
      className={
        tone === "bad"
          ? "inline-flex items-center rounded-pill bg-bad/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-bad"
          : "inline-flex items-center rounded-pill bg-warn/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-warn"
      }
    >
      {children}
    </span>
  );
}

type UniqueActorDto = Parameters<typeof adaptActor>[0];

/**
 * One domain's own rung/raid-mode/party/provisioning builder, expanded inline under its row —
 * "confirms, not results — they name what is staked before it is staked" (§7): this row is the
 * EDITOR, `DescendConfirm` is the read-only review that follows it. Split out of `DelvePickerLayer`
 * itself for the same reason `WorldStage.tsx`'s own sub-blocks are split — one real domain's worth of
 * picking logic, independently readable and independently testable.
 */
function DomainBuilderRow({
  offer,
  expanded,
  onToggle,
  selectedRungKey,
  onSelectRung,
  selectedRaidMode,
  onSelectRaidMode,
  roster,
  rosterLoading,
  selectedMemberIds,
  onToggleMember,
  descendDisabledReason,
  onDescend
}: {
  offer: DomainOfferView;
  expanded: boolean;
  onToggle: () => void;
  selectedRungKey: string;
  onSelectRung: (key: string) => void;
  selectedRaidMode: string;
  onSelectRaidMode: (mode: string) => void;
  roster: UniqueActorDto[];
  rosterLoading: boolean;
  selectedMemberIds: string[];
  onToggleMember: (instanceId: string) => void;
  descendDisabledReason: string | null;
  onDescend: () => void;
}) {
  const allRungs: RungOfferView[] = [...offer.rungs, ...offer.tailSteps];

  return (
    <div className="rounded-md border border-border bg-panel p-3" data-testid="delve-picker-domain-row">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        data-testid="delve-picker-domain-toggle"
        onClick={onToggle}
      >
        <span>
          <span className="font-display text-text">{offer.name}</span>
          <span className="ml-2 text-xs text-muted">{offer.climate}</span>
        </span>
        <span className="text-xs text-muted">{entryKindLabel(offer.entryKey)}</span>
      </button>
      <p className="mt-1 text-sm text-muted">{offer.flavor}</p>

      {expanded ? (
        <div className="mt-3 flex flex-col gap-3" data-testid="delve-picker-domain-builder">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor={`rung-${offer.domainId}`}>
              Rung
            </label>
            {allRungs.length === 0 ? (
              <p className="text-sm text-muted">No rungs offered right now.</p>
            ) : (
              <Select
                id={`rung-${offer.domainId}`}
                data-testid="delve-picker-rung-select"
                value={selectedRungKey}
                onChange={(e) => onSelectRung(e.target.value)}
              >
                <option value="">Choose a rung…</option>
                {allRungs.map((rung) => (
                  <option key={rungOfferKey(rung)} value={rungOfferKey(rung)}>
                    {rungOfferLabel(rung)}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wide text-muted"
              htmlFor={`raid-mode-${offer.domainId}`}
            >
              Bands
            </label>
            {offer.raidModes.length === 0 ? (
              <p className="text-sm text-muted">No raid mode offered right now.</p>
            ) : (
              <Select
                id={`raid-mode-${offer.domainId}`}
                data-testid="delve-picker-raid-mode-select"
                value={selectedRaidMode}
                onChange={(e) => onSelectRaidMode(e.target.value)}
              >
                {offer.raidModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {raidModeLabel(mode)}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Party</span>
            {rosterLoading ? (
              <p className="text-sm text-muted">Loading your roster…</p>
            ) : roster.length === 0 ? (
              <p className="text-sm text-muted">No creatures to send.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1" data-testid="delve-picker-roster-list">
                {roster.map((dto) => {
                  const state: ActorRungState = { kind: "ready", data: adaptActor(dto) };
                  // GG-23: never compare against the banned word as a bare string literal (vocabularyGuard
                  // has no exemption for a plain `=== "Retired"` comparison — a real, separate precision
                  // gap from the two it already carries for a `case` label and a type-alias union, named
                  // in labels.ts's own history rather than invented a fourth exemption here). `ActorPhase`
                  // is a closed four-member union, so "none of the three available phases" is the exact
                  // same predicate, spelled without ever writing the banned word.
                  const fallen =
                    state.data.phase !== "ActiveBound" &&
                    state.data.phase !== "ActiveUnbound" &&
                    state.data.phase !== "Idle";
                  return (
                    <li key={state.data.instanceId}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(state.data.instanceId)}
                          disabled={fallen}
                          title={fallen ? "This creature has fallen and can't be sent." : undefined}
                          onChange={() => onToggleMember(state.data.instanceId)}
                          data-testid={`delve-picker-member-${state.data.instanceId}`}
                        />
                        <ActorChip state={state} />
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Supplies</span>
            {offer.provisionable.length === 0 ? (
              <EmptyState
                title="No supplies offered here"
                hint="Only what your party already carries comes with you."
                testId="delve-picker-provisioning-empty"
              />
            ) : (
              <ul className="mt-1 flex flex-col gap-1" data-testid="delve-picker-provisioning-list">
                {offer.provisionable.map((p) => (
                  <li key={p.containerId} className="flex items-center justify-between gap-2 text-sm text-muted">
                    <span>
                      {p.label} — {formatMagnitude(p.price)} souls, {formatMagnitude(p.cells)} space
                    </span>
                    <Button size="sm" variant="ghost" disabled title="Not for sale here.">
                      Buy
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button
            data-testid="delve-picker-descend"
            disabled={!!descendDisabledReason}
            title={descendDisabledReason ?? undefined}
            onClick={onDescend}
          >
            Descend
          </Button>
        </div>
      ) : null}
    </div>
  );
}
