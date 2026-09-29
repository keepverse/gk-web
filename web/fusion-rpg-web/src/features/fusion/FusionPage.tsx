import { useEffect, useState } from "react";
import { usePlayers } from "@/lib/bus";
import { newCorrelationId, useCreatureRoster, useSoulBalance, useSpeciesIndex } from "@/lib/bus/creatures";
import { useCreatureMaterials } from "@/lib/bus/expeditions";
import {
  useFusionExecute,
  useFusionPreview,
  useFusionRecipes,
  type FusionMode,
  type FusionOutcomeDto,
  type SelectedPick
} from "@/lib/bus/fusion";
import { Page } from "@/layouts/Page";
import { usePatron } from "@/lib/bus/patron";
import { Badge, Banner, Button, EmptyState, Panel, TabList, TypeIcon } from "@/ui";
import { costWithPicks, haveNeed, recipeLabel, starPips, togglePick, STAR_CAPS } from "./fusionView";

/**
 * Fusion lab (spec-creature-fusion.md F9): star merges evolve the base, recipes consume all inputs;
 * costs preview server-side; undiscovered recipes render as silhouettes.
 */
export function FusionPage() {
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 0;
  const speciesById = useSpeciesIndex();
  const roster = useCreatureRoster(playerId);
  const patron = usePatron(playerId);
  const souls = useSoulBalance(playerId);
  const materials = useCreatureMaterials(playerId);
  const recipes = useFusionRecipes(playerId);
  const preview = useFusionPreview();
  const execute = useFusionExecute();

  const [mode, setMode] = useState<FusionMode>("star-merge");
  const [baseId, setBaseId] = useState<string | null>(null);
  const [sacrifices, setSacrifices] = useState<string[]>([]);
  const [pickedTrait, setPickedTrait] = useState<string | null>(null);
  const [selectedAtoms, setSelectedAtoms] = useState<SelectedPick[]>([]);
  const [reveal, setReveal] = useState<FusionOutcomeDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const speciesName = (id: string) => speciesById.get(id)?.name ?? id;

  const items = roster.data?.items ?? [];

  // Server-authoritative preview refreshes whenever the selection changes. The picked trait is
  // deliberately NOT sent: BuildPreview never reads it (only execute does), so previews stay
  // stable across trait clicks and the dependency list stays complete.
  const { mutate: previewMutate, reset: previewReset } = preview;
  useEffect(() => {
    setError(null);
    // A sacrifice change invalidates any atom picks made against the OLD pair — a stale pick
    // naming a specimen no longer in the request would bounce off the server's own
    // picks.source-not-a-sacrifice refusal.
    setSelectedAtoms([]);
    if (mode === "recipe" ? sacrifices.length !== 2 : !baseId) {
      previewReset();
      return;
    }
    previewMutate({ playerId, mode, baseInstanceId: baseId, sacrifices });
  }, [mode, baseId, sacrifices, playerId, previewMutate, previewReset]);

  const pickableAtoms = preview.data?.ok ? (preview.data.pickableAtoms ?? []) : [];
  const pickSlotCap = preview.data?.ok ? (preview.data.pickSlotCap ?? 0) : 0;
  const cost = preview.data?.ok ? preview.data.cost : undefined;
  const effectiveCost = cost ? costWithPicks(cost, selectedAtoms, pickableAtoms) : undefined;
  const affordability = effectiveCost
    ? haveNeed(effectiveCost, materials.data?.items ?? [], souls.data?.balance ?? 0)
    : null;

  function toggleSacrifice(id: string) {
    setSacrifices((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const cap = mode === "recipe" ? 2 : (preview.data?.sacrificesNeeded ?? 9);
      return prev.length < cap ? [...prev, id] : prev;
    });
  }

  async function run() {
    setError(null);
    try {
      const outcome = await execute.mutateAsync({
        playerId,
        mode,
        baseInstanceId: baseId,
        sacrifices,
        pickedTraitId: pickedTrait,
        picks: selectedAtoms,
        correlationId: newCorrelationId()
      });
      setReveal(outcome);
      setSacrifices([]);
      setPickedTrait(null);
      setSelectedAtoms([]);
      if (mode === "recipe") setBaseId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function creatureButton(s: (typeof items)[number], role: "base" | "sacrifice") {
    const id = s.profile.instanceId;
    const species = speciesById.get(s.profile.speciesId);
    const selected = role === "base" ? baseId === id : sacrifices.includes(id);
    const isPatron = patron.data?.patron?.instanceId === id;
    const disabled =
      role === "sacrifice" && (s.profile.locked || id === baseId || isPatron);
    const disabledReason =
      role !== "sacrifice"
        ? undefined
        : s.profile.locked
          ? "Locked — unlock it first"
          : id === baseId
            ? "Already chosen as the base"
            : isPatron
              ? "Your patron can't be sacrificed"
              : undefined;
    const cap = STAR_CAPS[s.profile.rarity] ?? 5;
    return (
      <button
        key={id}
        type="button"
        disabled={disabled}
        title={disabledReason}
        onClick={() => {
          if (role === "base") {
            setBaseId(selected ? null : id);
            // A creature promoted to base must leave the sacrifice tray — a stale id would submit
            // and bounce off the server's sacrifice.is-base refusal (2026-08-21 review).
            setSacrifices((prev) => prev.filter((x) => x !== id));
          } else {
            toggleSacrifice(id);
          }
        }}
        className={`flex items-center gap-2 rounded-sm border p-2 text-left text-sm ${
          selected ? "border-leaf" : "border-border"
        } ${disabled ? "opacity-40" : "cursor-pointer"}`}
        data-testid={`fusion-${role}-${id}`}
      >
        {species ? <TypeIcon side={species.side} typeId={species.gameTypeId} size={28} /> : null}
        <span className="min-w-0 flex-1 truncate">
          {s.profile.nickname ?? species?.name ?? s.profile.speciesId} · L{s.actor.level}
        </span>
        <span className="text-xs text-amber-300">{starPips(s.profile.star, cap)}</span>
        {isPatron ? <Badge>patron</Badge> : null}
        {s.profile.locked ? <Badge>locked</Badge> : null}
        {s.profile.promoted ? <Badge>promoted</Badge> : null}
      </button>
    );
  }

  return (
    <Page title="Fusion Lab" description="Feed, evolve, and craft — duplicates become power.">
      {error ? <Banner tone="error">{error}</Banner> : null}

      {reveal ? (
        <Panel title={reveal.replayed ? "Fusion (replayed)" : "Fusion complete"}>
          {reveal.newlyDiscovered ? (
            <Banner tone="info">New recipe discovered! +{reveal.discoverySouls} Souls</Banner>
          ) : null}
          {(reveal.minted ?? reveal.base) ? (
            <p className="text-sm">
              {reveal.minted ? "Born: " : "Evolved: "}
              <span className="font-semibold">
                {speciesName((reveal.minted ?? reveal.base)!.profile.speciesId)}
              </span>{" "}
              · {(reveal.minted ?? reveal.base)!.profile.rarity} ·{" "}
              {(reveal.minted ?? reveal.base)!.profile.traitIds.join(", ")}
              {reveal.base ? ` · ${starPips(reveal.base.profile.star, STAR_CAPS[reveal.base.profile.rarity] ?? 5)}` : ""}
            </p>
          ) : null}
          <Button className="mt-2" size="sm" variant="ghost" onClick={() => setReveal(null)}>
            Close
          </Button>
        </Panel>
      ) : null}

      <TabList
        tabs={[
          { id: "star-merge", label: "Star Merge" },
          { id: "promotion", label: "Promotion" },
          { id: "recipe", label: "Recipe Lab" }
        ]}
        value={mode}
        onChange={(v) => {
          setMode(v as FusionMode);
          setSacrifices([]);
          setPickedTrait(null);
          setSelectedAtoms([]);
        }}
      />

      {mode !== "recipe" ? (
        <Panel title="Base creature (survives with its history)">
          <div className="grid gap-2 sm:grid-cols-2">{items.map((s) => creatureButton(s, "base"))}</div>
        </Panel>
      ) : null}

      {mode !== "promotion" ? (
        <Panel
          title={
            mode === "recipe"
              ? "Ingredients (both consumed)"
              : `Sacrifices (${sacrifices.length}/${preview.data?.sacrificesNeeded ?? "?"} — consumed)`
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {items.filter((s) => s.profile.instanceId !== baseId).map((s) => creatureButton(s, "sacrifice"))}
          </div>
        </Panel>
      ) : null}

      {mode === "recipe" && preview.data?.ok && (preview.data.pickableTraits?.length ?? 0) > 0 ? (
        <Panel title="Inherit one trait (your pick is guaranteed)">
          <div className="flex flex-wrap gap-2">
            {preview.data.pickableTraits!.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={pickedTrait === t ? "primary" : "ghost"}
                onClick={() => setPickedTrait(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </Panel>
      ) : null}

      {mode === "recipe" && preview.data?.ok && pickableAtoms.length > 0 ? (
        <Panel title={`Inherit atoms (${selectedAtoms.length}/${pickSlotCap} — each priced by its own source's rarity)`}>
          <div className="flex flex-wrap gap-2">
            {pickableAtoms.map((a) => {
              const id = `${a.sourceInstanceId}::${a.atomId}`;
              const isSelected = selectedAtoms.some(
                (p) => p.sourceInstanceId === a.sourceInstanceId && p.atomId === a.atomId
              );
              const atCap = !isSelected && selectedAtoms.length >= pickSlotCap;
              return (
                <Button
                  key={id}
                  size="sm"
                  variant={isSelected ? "primary" : "ghost"}
                  disabled={atCap}
                  title={
                    atCap
                      ? `Full — this fusion carries at most ${pickSlotCap} inherited atom(s)`
                      : `${speciesName(a.sourceSpeciesId)}'s own roll · ${a.costSouls} Souls`
                  }
                  onClick={() =>
                    setSelectedAtoms((prev) =>
                      togglePick(prev, { sourceInstanceId: a.sourceInstanceId, atomId: a.atomId }, pickSlotCap)
                    )
                  }
                  data-testid={`fusion-pick-${id}`}
                >
                  {speciesName(a.sourceSpeciesId)}: {a.atomId} ({a.costSouls} Souls)
                </Button>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <Panel title="Cost">
        {preview.data && !preview.data.ok ? (
          <p className="text-sm text-muted">Not ready: {preview.data.reason}</p>
        ) : affordability ? (
          <div className="flex flex-wrap items-center gap-2">
            {affordability.lines.map((l) => (
              <Badge key={l.label} className={l.enough ? "" : "opacity-60"}>
                {l.label}: {l.have}/{l.need}
              </Badge>
            ))}
            {selectedAtoms.length > 0 ? (
              <Badge>+{effectiveCost!.souls - cost!.souls} Souls for {selectedAtoms.length} inherited atom(s)</Badge>
            ) : null}
            {mode === "recipe" && preview.data?.ok ? (
              <Badge>
                result:{" "}
                {preview.data.discovered && preview.data.resultSpeciesId
                  ? speciesName(preview.data.resultSpeciesId)
                  : `??? (${preview.data.resultRarity})`}
              </Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">Pick a base or ingredients to price the fusion.</p>
        )}
        <Button
          className="mt-3"
          onClick={() => void run()}
          disabled={
            execute.isPending ||
            !preview.data?.ok ||
            !(affordability?.affordable ?? false) ||
            (mode === "recipe" && (!pickedTrait || sacrifices.length !== 2))
          }
          title={
            execute.isPending
              ? "Fusing…"
              : !preview.data?.ok
                ? "Pick a base and ingredients to price the fusion first"
                : !(affordability?.affordable ?? false)
                  ? "Not enough Souls or ingredients"
                  : mode === "recipe" && (!pickedTrait || sacrifices.length !== 2)
                    ? "Recipe fusion needs a trait and exactly two sacrifices"
                    : undefined
          }
        >
          Fuse
        </Button>
      </Panel>

      <Panel title="Recipe book">
        {(recipes.data?.items ?? []).length === 0 ? (
          <EmptyState title="No recipes" hint="The catalog builds from the species roster." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {recipes.data!.items.map((item) => {
              const label = recipeLabel(item, speciesName);
              return (
                <div key={item.slot} className="rounded-sm border border-border p-2 text-sm">
                  <p className="font-semibold">
                    {label.title} <Badge className="ml-1">{item.resultRarity}</Badge>
                  </p>
                  <p className="text-xs text-muted">{label.subtitle}</p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </Page>
  );
}
