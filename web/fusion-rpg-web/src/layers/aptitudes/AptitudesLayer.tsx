import { useEffect, useState } from "react";
import { AptitudesPage } from "@/features/aptitudes/AptitudesPage";
import { SpeciesBuildPanel } from "@/features/species-build/SpeciesBuildPanel";
import { usePlayers } from "@/lib/bus";
import { PanelShell } from "@/shell/PanelShell";
import { TabList } from "@/ui";

type AptitudesTab = "commander" | "species";

/**
 * spec-aptitude-allocation-surface.md / spec-allocation-surface.md — a layer, never a route
 * (web/spec.md's own hard rule). Matches ExpeditionsLayer's own shape: wrapped in the shell.
 *
 * ⛔ THE HOST for `SpeciesBuildPanel` (owner, 2026-09-05, spec-allocation-surface.md) — this file was
 * previously imported by nothing; opening it now, per species, from `PactsLayer`'s roster is what
 * makes it a real production surface for the first time. `speciesId` is null when opened generically
 * (falls back to the Commander tab, the file's original-only content); non-null opens straight to the
 * Species tab for that one species, matching GG-10's ≤3-pushes budget from a roster row.
 */
export function AptitudesLayer({
  open,
  onOpenChange,
  speciesId = null
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  speciesId?: string | null;
}) {
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 0;
  const [tab, setTab] = useState<AptitudesTab>(speciesId ? "species" : "commander");

  // A NEW speciesId (a different roster row opened while this layer instance stays mounted) always
  // re-opens straight to that species' own tab -- the player asked to see a specific build, not
  // whichever tab was last open.
  useEffect(() => {
    if (speciesId) setTab("species");
  }, [speciesId]);

  return (
    <PanelShell open={open} onOpenChange={onOpenChange} title="Primary Stats" testId="aptitudes-layer">
      <TabList
        testId="aptitudes-tabs"
        value={tab}
        onChange={(id) => setTab(id as AptitudesTab)}
        tabs={[
          { id: "commander", label: "Commander" },
          { id: "species", label: "Species build" }
        ]}
      />
      {tab === "commander" ? (
        <AptitudesPage />
      ) : speciesId ? (
        <SpeciesBuildPanel playerId={playerId} speciesId={speciesId} />
      ) : (
        <p className="text-sm text-muted" data-testid="species-build-no-selection">
          Open this from a species in Pacts to see its build.
        </p>
      )}
    </PanelShell>
  );
}
