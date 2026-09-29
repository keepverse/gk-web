import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adaptCommanderSheet } from "@/contract/adapt";
import type { CommanderListRow } from "@/contract/types";
import { useCommanders, useSetDefaultCommander } from "@/lib/bus";
import { cn } from "@/lib/cn";
import { PanelShell } from "@/shell/PanelShell";
import { ActorPanel, type ActorRungState } from "@/ui/actor";
import { Badge, Banner, Button } from "@/ui";
import { EmptyState } from "@/ui/EmptyState";

function CommanderRow({
  row,
  selectedId,
  onSelect
}: {
  row: CommanderListRow;
  selectedId: string | null;
  onSelect: (commanderId: string | null) => void;
}) {
  const selected = row.id === selectedId;
  return (
    <button
      type="button"
      data-testid={`commanders-row-${row.id.replace(":", "-")}`}
      data-selected={selected}
      onClick={() => onSelect(selected ? null : row.id)}
      className={cn(
        "flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left last:border-b-0",
        "focus-visible:bg-panel-raised aria-current:bg-panel-raised"
      )}
      aria-current={selected}
    >
      <span className="min-w-0">
        <span className="block font-semibold text-text">{row.displayName}</span>
        {row.activeAuraName ? (
          <span className="text-xs text-muted">{row.activeAuraName}</span>
        ) : (
          <span className="text-xs text-muted">No aura</span>
        )}
      </span>
      {row.isDefault ? (
        <Badge tone="ok" data-testid={`commanders-default-badge-${row.id.replace(":", "-")}`}>
          default
        </Badge>
      ) : null}
    </button>
  );
}

/**
 * Commanders player layer (commander-surface P3) — empire roster, persisted default, travel to lawn.
 * Aptitudes is sheet-only via Progression tab; this layer replaces the old rail slot.
 */
export function CommandersLayer({
  open,
  onOpenChange,
  playerId,
  selectedId,
  onSelect
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: number;
  selectedId: string | null;
  onSelect: (commanderId: string | null) => void;
}) {
  const navigate = useNavigate();
  const query = useCommanders(playerId);
  const setDefault = useSetDefaultCommander(playerId);
  const commanders = query.data?.commanders ?? [];
  const defaultRow = commanders.find((c) => c.isDefault) ?? commanders[0];
  const selectedRow = selectedId ? commanders.find((c) => c.id === selectedId) : undefined;
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const effectiveSelected = selectedRow?.id ?? localSelected;
  const effectiveRow = effectiveSelected ? commanders.find((c) => c.id === effectiveSelected) : undefined;
  const setDefaultDisabledReason = !effectiveSelected
    ? "Pick a commander first"
    : setDefault.isPending
      ? "Working…"
      : effectiveSelected === defaultRow?.id
        ? "Already the default commander"
        : undefined;

  const sheetState: ActorRungState | null = effectiveRow
    ? { kind: "ready", data: adaptCommanderSheet(effectiveRow, playerId) }
    : null;

  const subtitle = useMemo(() => {
    if (!defaultRow) return "Your empire";
    return `Your empire · ${commanders.length} commander${commanders.length === 1 ? "" : "s"} · ${defaultRow.displayName} is default`;
  }, [commanders.length, defaultRow]);

  useEffect(() => {
    if (!open) setSheetOpen(false);
  }, [open]);

  useEffect(() => {
    if (open && selectedId) setSheetOpen(true);
  }, [open, selectedId]);

  function handleSelect(id: string | null) {
    setLocalSelected(id);
    onSelect(id);
    if (!id) setSheetOpen(false);
  }

  async function handleSetDefault(commanderId: string) {
    await setDefault.mutateAsync(commanderId);
  }

  return (
    <>
      <PanelShell
        open={open}
        onOpenChange={onOpenChange}
        title="Commanders"
        subtitle={subtitle}
        testId="commanders-layer"
      >
        {query.isLoading ? (
          <p className="text-sm text-muted" data-testid="commanders-loading" aria-busy="true">
            Loading commanders…
          </p>
        ) : query.isError ? (
          <Banner tone="error" data-testid="commanders-error">
            Couldn&apos;t load your commanders.
            <Button size="sm" variant="ghost" className="ml-2" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </Banner>
        ) : commanders.length === 0 ? (
          <EmptyState title="No commanders yet" hint="Your empire roster will appear here as it grows." />
        ) : (
          <div className="flex flex-col gap-4">
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel-inset p-3"
              data-testid="commanders-deploy-strip"
            >
              <p className="text-sm text-text">
                {defaultRow ? (
                  <>
                    Default: <strong>{defaultRow.displayName}</strong>
                    {defaultRow.activeAuraName ? ` · ${defaultRow.activeAuraName}` : ""}
                  </>
                ) : (
                  "Pick a commander"
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  data-testid="commanders-set-default"
                  disabled={!effectiveSelected || setDefault.isPending || effectiveSelected === defaultRow?.id}
                  title={setDefaultDisabledReason}
                  onClick={() => effectiveSelected && void handleSetDefault(effectiveSelected)}
                >
                  Set default
                </Button>
                <Button size="sm" variant="ghost" data-testid="commanders-defend" onClick={() => navigate("/lawn")}>
                  Defend the lawn
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border" data-testid="commanders-list">
              {commanders.map((row) => (
                <CommanderRow
                  key={row.id}
                  row={row}
                  selectedId={effectiveSelected}
                  onSelect={handleSelect}
                />
              ))}
            </div>

            {effectiveRow ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3" data-testid="commanders-selection-actions">
                <Button size="sm" data-testid="commanders-open-sheet" onClick={() => setSheetOpen(true)}>
                  Open sheet
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3" data-testid="commanders-footer">
              <Button
                size="sm"
                data-testid="commanders-footer-set-default"
                disabled={!effectiveSelected || setDefault.isPending || effectiveSelected === defaultRow?.id}
                title={setDefaultDisabledReason}
                onClick={() => effectiveSelected && void handleSetDefault(effectiveSelected)}
              >
                Set default
              </Button>
              <Button size="sm" variant="ghost" data-testid="commanders-footer-defend" onClick={() => navigate("/lawn")}>
                Defend the lawn
              </Button>
            </div>
          </div>
        )}
      </PanelShell>

      {sheetState && effectiveRow ? (
        <ActorPanel
          state={sheetState}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          role="commander"
          commanderMeta={{
            isDefault: effectiveRow.isDefault,
            activeAuraName: effectiveRow.activeAuraName,
            locationStub: effectiveRow.locationStub,
            legionStub: effectiveRow.legionStub
          }}
          setDefaultPending={setDefault.isPending}
          onSetDefault={() => void handleSetDefault(effectiveRow.id)}
          onDefendLawn={() => navigate("/lawn")}
          onOpenCommandersList={() => setSheetOpen(false)}
        />
      ) : null}
    </>
  );
}
