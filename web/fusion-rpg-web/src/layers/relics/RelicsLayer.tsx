import { useEffect, useMemo, useState } from "react";
import { useRelics, useUniqueActors, useUniqueEquipment, usePutUniqueEquipment } from "@/lib/bus";
import {
  useArmoury,
  useEquipItem,
  useItemAssignments,
  useItemCard,
  useItemCombinations,
  useItemCompare,
  useUnequipItem
} from "@/lib/bus/items";
import {
  PLAYER_PENDING,
  UNNAMED_ITEM,
  adaptArmouryItem,
  adaptArmouryPage,
  adaptCombinations,
  adaptEquipAssignments,
  adaptItemCard,
  adaptItemCompare,
  adaptRelic
} from "@/contract/adapt";
import { useSpeciesIndex } from "@/lib/bus/creatures";
import { absent, known, pendingWithReason } from "@/contract/pending";
import type { ArmouryRowView, ItemRoleId, PieceSetDisclosureView } from "@/contract/types";

type RelicDto = Parameters<typeof adaptRelic>[0];
import { PanelShell } from "@/shell/PanelShell";
import { EmptyState } from "@/ui/EmptyState";
import { Banner, Button, Select } from "@/ui";
import { ArmouryList } from "./ArmouryList";
import { CompareView } from "./CompareView";
import { Compendium } from "./Compendium";
import { ItemCard } from "./ItemCard";
import { Paperdoll, ROLE_REGISTRY, type PaperdollWorn } from "./Paperdoll";
import { SocketBench } from "./SocketBench";
import { CraftBench } from "./Workbench";

type Tab = "held" | "armoury" | "equipped" | "storage";

/**
 * ⚠ **No route serves an item's own role**, so the player picks the slot and the server corrects a
 * wrong pick by name (`equip.role-mismatch: '…' is a 'head-guard' item, not a 'armament-primary'`).
 * The armoury row carries `role: ""` — module 20's route leaves it empty on purpose while module 6
 * has no `item_base_type` table — and inventing one here from the container id would be a guess
 * that reads as fact. Same shape as the craft bench's typed recipe id, and the same reason.
 */
const ROLE_PICK_HINT =
  "Pick the slot you think it goes in — if it's the wrong one, the answer says which slot it is.";

function RelicRow({
  relic,
  equippedSlotLabel,
  selected,
  onSelect
}: {
  relic: RelicDto;
  equippedSlotLabel?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const view = adaptRelic(relic);
  return (
    <button
      type="button"
      data-testid={`relics-row-${relic.id}`}
      data-selected={selected}
      aria-current={selected}
      onClick={onSelect}
      className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 focus-visible:bg-panel-raised aria-current:bg-panel-raised"
    >
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full"
        style={{ background: view.header.rarity.colour }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-text">{view.header.name}</span>
        <span className="block text-xs text-muted">
          {view.header.baseTypeAndClassNoun} · {view.header.rarity.display}
          {equippedSlotLabel ? <b className="ml-1 text-text">· equipped</b> : null}
        </span>
      </span>
    </button>
  );
}

/**
 * The Relics layer — the home for every item surface. **No route, no stage, no sibling screen.**
 * Comparison, the socket bench and the compendium are sub-views inside this panel and inside the
 * two band-3 dialogs it pushes, so the depth budget stays at three: Relics, item, bench.
 *
 * Four tabs, four of the six surfaces reachable from them (the item card and comparison are what
 * the detail pane under a selection renders, not tabs of their own):
 *
 * - **Held** — the seeded relic catalog and the equip flow that ships today. Equipping persists as
 *   an assignment row; the payload still speaks three slot words rather than the fifteen roles, and
 *   widening it moves the wire and this layer's literal together.
 * - **Armoury** — the real item instances a player owns, over the read-only armoury route, with the
 *   loot filter and the inbox.
 * - **Equipped** — the paperdoll.
 * - **Storage** — held and stored are not split yet, and the tab says so rather than faking a split.
 *
 * ⚠ **Every write on this surface is one of the existing owners' writes.** The armoury, surfaces and
 * combination routes stay read-only by design — a second write path through the presentation layer
 * is the duplicate surface the item-surfaces module exists to prevent. So the two writes reachable
 * from here go to their real owners and to two different server files:
 *
 * - **Held → Equip** is the relic equip that already shipped —
 *   `PUT /api/unique/actors/{instanceId}/equipment/{slot}`, over the four hand-authored relics.
 * - **Armoury → Sockets / Craft** are the workbench's verbs —
 *   `POST /api/items/workbench/*`, over real item instances.
 *
 * - **Armoury → Equip / Take off** are item module 4's —
 *   `POST /api/items/equip` and `/api/items/unequip`, over the fifteen roles.
 *
 * ⛔ **Those three are not the same flow and must not be merged.** A relic is a seeded catalog row
 * with a three-word slot; an armoury item is a generated instance with a fifteen-role future. They
 * write the same table (`rpg_item_assignment`, since the 2026-09-06 relic row migration) through
 * two different endpoints, because the relic path also rebuilds `mods_json` and reconciles the
 * `unique-equip` atom bindings in the same call. Each refuses the other's rows by name rather than
 * clobbering them, and this layer keeps them in separate tabs for the same reason.
 */
export function RelicsLayer({
  open,
  onOpenChange,
  playerId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: number;
}) {
  const [tab, setTab] = useState<Tab>("held");
  const [actorId, setActorId] = useState<string>("");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [armouryRow, setArmouryRow] = useState<ArmouryRowView | null>(null);
  const [benchOpen, setBenchOpen] = useState(false);
  const [craftOpen, setCraftOpen] = useState(false);
  const [compendiumOpen, setCompendiumOpen] = useState(false);
  const [equipRole, setEquipRole] = useState<ItemRoleId>("armament-primary");
  const [equipError, setEquipError] = useState<Error | null>(null);

  const actorsQuery = useUniqueActors(playerId);
  const actors = actorsQuery.data?.items ?? [];

  /**
   * ⛔ **The equip target is named, never a GUID** (item-content `item-naming` T3). A unique actor
   * carries `side` + `typeId` and no name of its own (`adaptActor` marks `displayName` pending, and
   * no route serves one), so the real name comes from the creature species catalog, which authors one
   * per (side, gameTypeId) and is the same index the creatures, fusion and expedition pages already
   * read. React Query dedupes it — the catalog is fetched once per session.
   *
   * A type the catalog does not carry falls back to `plant #37`, the SAME shape
   * `AlmanacDumpPage`/`IconDumpPage` already use for an unnamed type — a type number is not the
   * instance GUID this task removes, and inventing an English name for an unknown type would be
   * worse than saying which type it is.
   */
  const speciesIndex = useSpeciesIndex();
  const speciesNameByType = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of speciesIndex.values()) map.set(`${entry.side}:${entry.gameTypeId}`, entry.name);
    return map;
  }, [speciesIndex]);
  const actorName = (side: string, typeId: number) =>
    speciesNameByType.get(`${side}:${typeId}`) ?? `${side} #${typeId}`;
  useEffect(() => {
    if (!actorId && actors.length > 0) setActorId(actors[0]!.instanceId);
  }, [actorId, actors]);

  const relicsQuery = useRelics();
  const relics = relicsQuery.data?.items ?? [];
  const equipQuery = useUniqueEquipment(actorId || null);
  const equippedSlots = equipQuery.data?.items ?? [];
  const equipMutation = usePutUniqueEquipment();

  // item module 4 — the fifteen-role assignment list and its two writes. A separate read from
  // `useUniqueEquipment` above because that one projects the same table down to three slot words.
  const assignmentsQuery = useItemAssignments(actorId || null);
  const assignments = useMemo(
    () => (assignmentsQuery.data ? adaptEquipAssignments(assignmentsQuery.data) : []),
    [assignmentsQuery.data]
  );
  const equipItem = useEquipItem();
  const unequipItem = useUnequipItem();
  const equipBusy = equipItem.isPending || unequipItem.isPending;

  // The armoury page, for instance → container so a worn item can be named. React Query dedupes
  // this against `ArmouryList`'s own call — same key, one request.
  const armouryQuery = useArmoury(playerId);
  const armouryRows = useMemo(
    () => (armouryQuery.data ? adaptArmouryPage(armouryQuery.data).rows : []),
    [armouryQuery.data]
  );
  const containerOfInstance = useMemo(
    () => new Map(armouryRows.map((r) => [r.instanceId, r.containerId])),
    [armouryRows]
  );
  /**
   * item-content `item-naming` (T3): the base type's own authored name per container, off the
   * armoury row. The relic catalog covers only the four seeded relics; every real rolled item's
   * noun comes from here, and neither map ever answers with the container id.
   */
  const baseNameOfContainer = useMemo(
    () =>
      new Map(
        armouryRows
          .filter((r): r is typeof r & { containerName: string } => r.containerName !== null)
          .map((r) => [r.containerId, r.containerName])
      ),
    [armouryRows]
  );

  useEffect(() => {
    if (!open) {
      setBenchOpen(false);
      setCraftOpen(false);
      setCompendiumOpen(false);
    }
  }, [open]);

  const equippedByRelicId = new Map(equippedSlots.filter((s) => s.itemId).map((s) => [s.itemId, s.slot]));
  const candidate = candidateId ? relics.find((r) => r.id === candidateId) ?? null : null;
  const currentInCandidateSlot = candidate
    ? relics.find((r) => equippedByRelicId.get(r.id) === candidate.slot) ?? null
    : null;

  const selectedActor = actors.find((a) => a.instanceId === actorId);

  /**
   * ⛔ **Never the container id** (item-content `item-naming` T3). Three real sources in order — the
   * seeded relic catalog, then the base type's own authored name off the armoury row (T2's field),
   * then a sentence saying this build has no name for it. `item.plate-helm.fused` in a name slot is
   * the defect T3 removes, and a prettified id would still be one.
   */
  const relicNames = useMemo(() => new Map(relics.map((r) => [r.id, r.name])), [relics]);
  const nameFor = useMemo(
    () => (containerId: string) =>
      relicNames.get(containerId) ?? baseNameOfContainer.get(containerId) ?? UNNAMED_ITEM,
    [relicNames, baseNameOfContainer]
  );

  /**
   * Both flows' pieces, in one paperdoll. Items come first so that when the same role somehow
   * carries both, the cell shows the one this screen can actually take off — the server refuses
   * that overlap on the way in, so it should never happen, and the order is the safe direction if
   * it ever does.
   */
  const worn: PaperdollWorn[] = [
    ...assignments
      .filter((a) => a.source === "item")
      .map((a) => ({
        role: a.role,
        instanceId: a.refId,
        itemName: nameFor(containerOfInstance.get(a.refId) ?? a.refId),
        rarity: null,
        source: "item" as const
      })),
    ...equippedSlots
      .filter((s) => s.itemId)
      .map((s) => {
        const relic = relics.find((r) => r.id === s.itemId);
        const view = relic ? adaptRelic(relic) : null;
        return {
          slot: s.slot,
          instanceId: s.itemId,
          // T3: a relic the catalog no longer carries says so; its id is not its name.
          itemName: view?.header.name ?? UNNAMED_ITEM,
          rarity: view?.header.rarity ?? null,
          source: "relic" as const
        };
      })
  ];

  /** Which role, if any, holds the selected armoury row on the selected specimen. */
  const wornRoleOfSelection = armouryRow
    ? assignments.find((a) => a.source === "item" && a.refId === armouryRow.instanceId)?.role ?? null
    : null;

  function runEquip(action: () => void) {
    setEquipError(null);
    action();
  }

  const equipHandlers = {
    onError: (error: Error) => setEquipError(error),
    onSuccess: () => setEquipError(null)
  };

  /**
   * ⭐ item module 10's rendered card, over `GET /api/items/{instanceId}/card` — the route that
   * landed 2026-09-06 and turned every block below the header from "pending" into real content.
   *
   * The specimen is passed whenever one is selected: requirements, the equip gate's refusal and set
   * progress are facts about a WEARER, and asking without one is a different card, not a poorer one.
   *
   * The combination rows come from the dedicated combinations route rather than from the card,
   * because `CombinationView` also carries the shape and the granted tier and only that route
   * reports them. React Query dedupes it against the compendium's identical call.
   */
  const cardQuery = useItemCard(armouryRow?.instanceId ?? null, actorId || null);
  const combinationsQuery = useItemCombinations(armouryRow?.instanceId ?? null, playerId);
  const combinations = useMemo(
    () => (combinationsQuery.data ? adaptCombinations(combinationsQuery.data) : []),
    [combinationsQuery.data]
  );

  /**
   * The incumbent this selection would displace: whatever ITEM the specimen already wears in the
   * role the equip control is aimed at. `null` when that role is empty, when the selection is
   * already worn, or when the incumbent is a relic — the compare route takes two rolled instances,
   * and a relic is a catalog id on the other flow's write path.
   */
  const compareIncumbentId =
    armouryRow && !wornRoleOfSelection
      ? assignments.find((a) => a.source === "item" && a.role === equipRole)?.refId ?? null
      : null;
  const compareQuery = useItemCompare(armouryRow?.instanceId ?? null, compareIncumbentId, actorId || null);

  /**
   * ⚠ The fallback, and it is still honest rather than empty: while the card route is in flight — or
   * when it refuses, which it does by name for a container module 6's base-type corpus does not
   * carry — the row's own identity, rarity and flags are real and every other block says "not shown
   * yet" instead of showing a number nobody computed.
   */
  const armouryCard = cardQuery.data
    ? adaptItemCard(cardQuery.data, combinations)
    : armouryRow
      ? adaptArmouryItem(armouryRow, nameFor(armouryRow.containerId))
      : null;

  /** No route reports which sets a worn piece advances yet, and the relic catalog declares none. */
  const setDisclosure = absent<PieceSetDisclosureView[]>();

  return (
    <>
      <PanelShell
        open={open}
        onOpenChange={onOpenChange}
        title="Relics"
        subtitle={
          selectedActor
            ? // Same rule as the dropdown: the species' own name, never a slice of the GUID. A
              // shortened id is still an id (item-content `item-naming` T3).
              `Equipping to ${actorName(selectedActor.side, selectedActor.typeId)} · ${equippedSlots.length} of 3 slots used`
            : "Held"
        }
        testId="relics-layer"
        footer={
          <div className="flex w-full flex-wrap items-center gap-2" data-testid="relics-tabs">
            <button
              type="button"
              data-testid="relics-tab-held"
              aria-current={tab === "held"}
              onClick={() => setTab("held")}
              className={`rounded-sm border px-2 py-1 text-xs ${tab === "held" ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"}`}
            >
              Held
            </button>
            <button
              type="button"
              data-testid="relics-tab-armoury"
              aria-current={tab === "armoury"}
              onClick={() => setTab("armoury")}
              className={`rounded-sm border px-2 py-1 text-xs ${tab === "armoury" ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"}`}
            >
              Armoury
            </button>
            <button
              type="button"
              data-testid="relics-tab-equipped"
              aria-current={tab === "equipped"}
              onClick={() => setTab("equipped")}
              className={`rounded-sm border px-2 py-1 text-xs ${tab === "equipped" ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"}`}
            >
              Equipped
            </button>
            <button
              type="button"
              data-testid="relics-tab-storage"
              aria-current={tab === "storage"}
              onClick={() => setTab("storage")}
              className={`rounded-sm border px-2 py-1 text-xs ${tab === "storage" ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"}`}
            >
              Storage
            </button>
          </div>
        }
      >
        {actorsQuery.isLoading || relicsQuery.isLoading ? (
          <p className="text-sm text-muted" data-testid="relics-loading" aria-busy="true">
            Loading relics…
          </p>
        ) : actorsQuery.isError || relicsQuery.isError ? (
          <Banner tone="error" data-testid="relics-error">
            Couldn't load relics.
            <Button
              size="sm"
              variant="ghost"
              className="ml-2"
              onClick={() => {
                void actorsQuery.refetch();
                void relicsQuery.refetch();
              }}
            >
              Retry
            </Button>
          </Banner>
        ) : actors.length === 0 ? (
          <EmptyState title="No creatures bound yet" hint="Bind a creature to equip relics to it." />
        ) : (
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm text-muted">
              Equipping to
              <Select
                data-testid="relics-actor-select"
                value={actorId}
                onChange={(e) => {
                  setActorId(e.target.value);
                  setCandidateId(null);
                }}
              >
                {actors.map((a) => (
                  <option key={a.instanceId} value={a.instanceId}>
                    {actorName(a.side, a.typeId)} · Lv {a.level}
                  </option>
                ))}
              </Select>
            </label>

            {tab === "held" ? (
              // Stacked rather than the plate's side-by-side columns: the panel caps every layer at
              // 640px, and two columns inside that cap left the comparison too narrow to read
              // comfortably at any width.
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                    Held — pick one to see what it changes
                  </p>
                  <div className="rounded-md border border-border" data-testid="relics-list">
                    {relics.map((relic) => (
                      <RelicRow
                        key={relic.id}
                        relic={relic}
                        equippedSlotLabel={equippedByRelicId.get(relic.id)}
                        selected={relic.id === candidateId}
                        onSelect={() => setCandidateId(relic.id === candidateId ? null : relic.id)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  {candidate ? (
                    <div data-testid="relics-compare">
                      {currentInCandidateSlot?.id === candidate.id ? (
                        <>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                            {candidate.name} is already equipped
                          </p>
                          <ItemCard item={adaptRelic(candidate)} testId="relics-card" />
                        </>
                      ) : (
                        <CompareView
                          candidate={adaptRelic(candidate)}
                          incumbent={currentInCandidateSlot ? adaptRelic(currentInCandidateSlot) : null}
                          payload={pendingWithReason(PLAYER_PENDING.itemCompare)}
                        />
                      )}
                      {currentInCandidateSlot?.id !== candidate.id ? (
                        <div className="mt-4 flex gap-2">
                          <Button
                            data-testid="relics-equip-btn"
                            disabled={equipMutation.isPending}
                            title={equipMutation.isPending ? "Equipping…" : undefined}
                            onClick={() =>
                              equipMutation.mutate({
                                instanceId: actorId,
                                slot: candidate.slot,
                                itemId: candidate.id
                              })
                            }
                          >
                            Equip
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <EmptyState title="Pick a held relic" hint="Its comparison appears here before you equip it." />
                  )}
                </div>
              </div>
            ) : null}

            {tab === "armoury" ? (
              <div className="flex flex-col gap-4">
                <ArmouryList
                  playerId={playerId}
                  selectedId={armouryRow?.instanceId ?? null}
                  onSelect={setArmouryRow}
                  nameFor={nameFor}
                />

                {armouryCard ? (
                  <div className="flex flex-col gap-2" data-testid="armoury-detail">
                    {/* ⭐ GG-47: the comparison is the DEFAULT presentation when a candidate is
                      * selected against an occupied role — not a tooltip and not an extra click. Both
                      * cards, the verdict, the trade and the unit-class grouping arrive from
                      * `GET /api/items/{id}/compare/{incumbentId}` already decided. With no incumbent
                      * there is nothing to weigh, and the single card is the whole answer. */}
                    {compareQuery.data ? (
                      <CompareView
                        candidate={adaptItemCard(compareQuery.data.candidate, combinations)}
                        incumbent={adaptItemCard(compareQuery.data.incumbent)}
                        payload={known(adaptItemCompare(compareQuery.data))}
                      />
                    ) : (
                      <ItemCard item={armouryCard} testId="armoury-card" />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" data-testid="armoury-open-bench" onClick={() => setBenchOpen(true)}>
                        Sockets
                      </Button>
                      <Button size="sm" variant="ghost" data-testid="armoury-open-craft" onClick={() => setCraftOpen(true)}>
                        Craft
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid="armoury-open-compendium"
                        onClick={() => setCompendiumOpen(true)}
                      >
                        Compendium
                      </Button>
                    </div>

                    {/* ⭐ item module 4's real write path — `POST /api/items/equip` / `/unequip`.
                      * Not the Held tab's relic PUT and not a workbench verb: a different owner, a
                      * different file on the server, and the only one of the three that speaks all
                      * fifteen roles. */}
                    <div className="flex flex-col gap-2 border-t border-border pt-2" data-testid="armoury-equip">
                      {equipError ? (
                        <Banner tone="error" data-testid="armoury-equip-error">
                          {equipError.message}
                        </Banner>
                      ) : null}

                      {wornRoleOfSelection ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted" data-testid="armoury-worn-role">
                            Worn in <b className="text-text">{wornRoleOfSelection}</b>
                          </span>
                          <Button
                            size="sm"
                            data-testid="armoury-unequip-btn"
                            disabled={equipBusy}
                            title={equipBusy ? "Still working on the last change" : undefined}
                            onClick={() =>
                              runEquip(() =>
                                unequipItem.mutate(
                                  { playerId, specimenId: actorId, role: wornRoleOfSelection },
                                  equipHandlers
                                )
                              )
                            }
                          >
                            Take off
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            data-testid="armoury-equip-role"
                            aria-label="Slot to equip into"
                            value={equipRole}
                            onChange={(e) => setEquipRole(e.target.value as ItemRoleId)}
                          >
                            {ROLE_REGISTRY.map((entry) => (
                              <option key={entry.role} value={entry.role}>
                                {entry.role} · {entry.humanoidName} / {entry.plantName}
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            data-testid="armoury-equip-btn"
                            disabled={equipBusy || actorId.length === 0}
                            title={actorId.length === 0 ? "Pick a creature to equip to first" : undefined}
                            onClick={() =>
                              runEquip(() =>
                                equipItem.mutate(
                                  {
                                    playerId,
                                    specimenId: actorId,
                                    instanceId: armouryRow!.instanceId,
                                    role: equipRole
                                  },
                                  equipHandlers
                                )
                              )
                            }
                          >
                            Equip
                          </Button>
                          <span className="text-2xs text-muted" data-testid="armoury-equip-hint">
                            {ROLE_PICK_HINT}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "equipped" ? (
              <div className="flex flex-col gap-2">
                {equipError ? (
                  <Banner tone="error" data-testid="paperdoll-equip-error">
                    {equipError.message}
                  </Banner>
                ) : null}
                <Paperdoll
                  worn={worn}
                  selectedId={null}
                  onSelect={() => {}}
                  busy={equipBusy}
                  onUnequip={(role) =>
                    runEquip(() =>
                      unequipItem.mutate({ playerId, specimenId: actorId, role }, equipHandlers)
                    )
                  }
                />
              </div>
            ) : null}

            {tab === "storage" ? (
              <EmptyState
                title="Storage isn't tracked yet"
                hint="Held and stored relics aren't split yet — everything you hold shows on the Held tab."
              />
            ) : null}
          </div>
        )}
      </PanelShell>

      {armouryRow ? (
        <>
          <SocketBench
            open={benchOpen}
            onOpenChange={setBenchOpen}
            instanceId={armouryRow.instanceId}
            itemName={nameFor(armouryRow.containerId)}
            playerId={playerId}
            cells={[]}
          />
          {/* The selection is deliberately NOT cleared after a break-down: the result panel is worth
           * reading, the list behind it refetches on its own, and a second verb aimed at a salvaged
           * item comes back refused by name (`item.not-owned: … is 'salvaged'`) rather than silently. */}
          <CraftBench
            open={craftOpen}
            onOpenChange={setCraftOpen}
            instanceId={armouryRow.instanceId}
            itemName={nameFor(armouryRow.containerId)}
            playerId={playerId}
          />
          <Compendium
            open={compendiumOpen}
            onOpenChange={setCompendiumOpen}
            instanceId={armouryRow.instanceId}
            itemName={nameFor(armouryRow.containerId)}
            playerId={playerId}
            setDisclosure={setDisclosure}
          />
        </>
      ) : null}
    </>
  );
}
