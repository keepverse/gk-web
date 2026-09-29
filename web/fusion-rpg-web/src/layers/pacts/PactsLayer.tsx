import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreatureRoster, usePlayers, useSpeciesIndex } from "@/lib/bus";
import { newCorrelationId } from "@/lib/bus/creatures";
import { usePatron, useSetPatron } from "@/lib/bus/patron";
import { useBuyContractSlot, useContracts, usePerformRitual, useReleaseContract } from "@/lib/bus/contracts";
import {
  capacityLabel,
  conditionOf,
  fieldingBlockReason,
  loyaltyFraction,
  rankLabel
} from "@/features/creatures/contractView";
import { displayName } from "@/features/creatures/rosterSplit";
import { rarityTintToken } from "@/features/creatures/rarityLadder";
import { auraLabel, auraPreviewMilli } from "@/features/creatures/patronView";
import { AptitudesLayer } from "@/layers/aptitudes/AptitudesLayer";
import { PanelShell } from "@/shell/PanelShell";
import { EmptyState } from "@/ui/EmptyState";
import { Badge, Banner, Button } from "@/ui";

// T30 (plate 03 §D): a colour-tinted portrait per card. No creature art registry exists (game-gui-map.md
// assumption 6 — art is out, the registry is in), so this is the same honest substitute
// `ui/actor/shared.tsx`'s `ActorFrame` already uses for creatures — an initial inside a coloured
// frame — reusing the existing `--color-rarity-*` tokens rather than inventing a creature-specific
// palette. Species-gear-chain T17: the tint reads the ten-rung ladder (two rungs per token, rising)
// instead of the retired four-value map it replaced; an unknown id falls back to the neutral border
// (decorative only — the badge beside it carries the visible unknown marker).
function PactPortrait({ rarity, initial }: { rarity: string; initial: string }) {
  return (
    <span
      data-testid="pact-portrait"
      className={`flex h-11 w-11 flex-none items-center justify-center rounded-md border-2 bg-panel-inset font-display text-lg uppercase text-text ${rarityTintToken(rarity)}`}
    >
      {initial}
    </span>
  );
}

/**
 * T17 — the creature contracts layer (plate 03 §D, spec-creature-contracts.md): loyalty, tribute,
 * Ritual/Release, each carrying its reason inline. The underlying mechanics (`contractView.ts`,
 * the bind/release/ritual/patron mutations) are the same real ones `CreaturesPage.tsx` already
 * uses — this is a dedicated, focused view over them, not a new contract system. The plate's
 * "price" line on a content pact's aura doesn't exist server-side (`patronView.ts`'s aura is a
 * pure benefit, no downside term) — shown honestly as a benefit only, not invented.
 */
export function PactsLayer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 0;
  const roster = useCreatureRoster(playerId);
  const speciesById = useSpeciesIndex();
  const contracts = useContracts(playerId);
  const patron = usePatron(playerId);
  const setPatron = useSetPatron();
  const releaseContract = useReleaseContract();
  const performRitual = usePerformRitual();
  const buySlot = useBuyContractSlot();

  const rows = contracts.data?.contracts.filter((c) => c.bound) ?? [];
  const bySpecimenId = new Map((roster.data?.items ?? []).map((s) => [s.profile.instanceId, s]));

  // spec-allocation-surface.md — the chosen entry point (owner, 2026-09-05): a "View build" button on
  // each pact row, opening `AptitudesLayer` as a NESTED layer scoped to that row's own `speciesId`,
  // the same locally-owned open/close pattern `CommandersLayer` already uses for its nested
  // `ActorPanel` sheet rather than a second top-level rail slot.
  const [buildSpeciesId, setBuildSpeciesId] = useState<string | null>(null);

  return (
    <>
    <PanelShell
      open={open}
      onOpenChange={onOpenChange}
      title="Pacts"
      subtitle={contracts.data ? capacityLabel(contracts.data) : undefined}
      testId="pacts-layer"
      footer={
        contracts.data ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={!contracts.data.capacity.canBuy}
            title={
              contracts.data.capacity.canBuy
                ? `Buy slot ${contracts.data.capacity.total + 1}`
                : "Every slot has been bought"
            }
            onClick={() => void buySlot.mutateAsync({ playerId, correlationId: newCorrelationId() })}
            data-testid="pacts-buy-slot"
          >
            Buy slot
          </Button>
        ) : undefined
      }
    >
      {contracts.isLoading || roster.isLoading ? (
        <p className="text-sm text-muted" data-testid="pacts-loading" aria-busy="true">
          Loading pacts…
        </p>
      ) : contracts.isError || roster.isError ? (
        <Banner tone="error" data-testid="pacts-error">
          Couldn't load pacts.
          <Button
            size="sm"
            variant="ghost"
            className="ml-2"
            onClick={() => {
              void contracts.refetch();
              void roster.refetch();
            }}
          >
            Retry
          </Button>
        </Banner>
      ) : rows.length === 0 ? (
        // G4 (species-build-todo.md): Pacts stays locked until a first contract exists
        // (railState.ts's hasAnyContract), and the only UI that binds one lives on `/creatures` —
        // which nothing else in the app links to. This hint already named "the Creatures roster";
        // now it's a real link there instead of just text that mentions it.
        <EmptyState
          title="No pacts yet"
          hint="Bind a creature's contract from the Creatures roster to see it here."
          action={
            <Button size="sm" onClick={() => navigate("/creatures")} data-testid="pacts-empty-open-creatures">
              Open Creatures roster
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3" data-testid="pacts-grid">
          {rows.map((c) => {
            const specimen = bySpecimenId.get(c.instanceId);
            const species = specimen ? speciesById.get(specimen.profile.speciesId) : undefined;
            const condition = conditionOf(c);
            const isPatron = patron.data?.patron?.instanceId === c.instanceId;
            const name = specimen ? displayName(specimen, species?.name) : c.instanceId;
            return (
              <div
                key={c.instanceId}
                className={`min-w-0 rounded-md border p-3 ${condition === "insubordinate" ? "border-bad" : "border-border"}`}
                data-testid={`pact-${c.instanceId}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <PactPortrait rarity={specimen?.profile.rarity ?? "common"} initial={name.slice(0, 1)} />
                    <span className="truncate font-semibold text-text">{name}</span>
                  </div>
                  <Badge className={condition === "insubordinate" ? "" : undefined}>
                    {condition === "insubordinate" ? "tribute overdue" : "content"}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-muted">
                  {rankLabel(c.rank)} · {c.personality} · {c.upkeepPerDay} souls/day
                </div>
                <div className="mt-2 h-1.5 w-full rounded-pill bg-panel" data-testid={`pact-loyalty-${c.instanceId}`}>
                  <div
                    className={`h-full rounded-pill ${condition === "insubordinate" ? "bg-bad-solid" : "bg-lawn"}`}
                    style={{ width: `${Math.round(loyaltyFraction(c.loyalty) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">Loyalty {c.loyalty} / 1000</p>

                {isPatron && specimen ? (
                  <p className="mt-2 text-xs text-text" data-testid={`pact-aura-${c.instanceId}`}>
                    Patron —{" "}
                    {auraLabel(
                      specimen.profile.elementPrimary,
                      auraPreviewMilli(specimen.profile.rarity, specimen.profile.star, Number(specimen.actor.level)),
                      Math.floor(
                        auraPreviewMilli(specimen.profile.rarity, specimen.profile.star, Number(specimen.actor.level)) / 2
                      )
                    )}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!specimen}
                    title={specimen ? undefined : "Roster entry still loading"}
                    onClick={() => specimen && setBuildSpeciesId(specimen.profile.speciesId)}
                    data-testid={`pact-view-build-${c.instanceId}`}
                  >
                    View build
                  </Button>
                  {condition === "insubordinate" ? (
                    <>
                      <Button size="sm" disabled title="Renegotiate" data-testid={`pact-renegotiate-${c.instanceId}`}>
                        Renegotiate
                      </Button>
                      <span className="text-xs text-muted" data-testid={`pact-renegotiate-reason-${c.instanceId}`}>
                        — {fieldingBlockReason(c)}
                      </span>
                      <span className="flex-1" />
                      <Button
                        size="sm"
                        onClick={() =>
                          void performRitual.mutateAsync({ playerId, instanceId: c.instanceId, correlationId: newCorrelationId() })
                        }
                        data-testid={`pact-ritual-${c.instanceId}`}
                      >
                        Ritual
                      </Button>
                    </>
                  ) : (
                    <>
                      {!isPatron ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          title={patron.data?.patron ? `Switch costs ${patron.data.switchCostSouls} Souls` : "First patron is free"}
                          onClick={() =>
                            void setPatron.mutateAsync({ playerId, instanceId: c.instanceId, correlationId: newCorrelationId() })
                          }
                          data-testid={`pact-make-patron-${c.instanceId}`}
                        >
                          Make patron
                        </Button>
                      ) : null}
                      <span className="flex-1" />
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Frees the slot; the creature keeps its loyalty"
                        onClick={() => void releaseContract.mutateAsync({ playerId, instanceId: c.instanceId })}
                        data-testid={`pact-release-${c.instanceId}`}
                      >
                        Release
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
    <AptitudesLayer
      open={buildSpeciesId !== null}
      onOpenChange={(next) => {
        if (!next) setBuildSpeciesId(null);
      }}
      speciesId={buildSpeciesId}
    />
    </>
  );
}
