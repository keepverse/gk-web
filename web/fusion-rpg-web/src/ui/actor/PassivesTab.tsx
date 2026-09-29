import { useEffect, useState } from "react";
import { useAptitudes, usePassiveTree, usePlayers, usePreviewTree, useSaveTreeNodes, useSoulBalance } from "@/lib/bus";
import { Banner, Button, EmptyState, TabList } from "@/ui";
import {
  draftFocusPreview,
  focusReading,
  investedTrees,
  notWorkingTraits,
  type NotWorkingTrait
} from "@/contract/passivesYours";
import { EMPTY_PATH_BROWSE_QUERY, type PathBrowseQuery } from "@/contract/passivesBrowse";
import {
  closePreview,
  closePreviewSentence,
  decodePlanCode,
  encodePlanCode,
  mergeSoulLevels,
  planNewNodeIds,
  planPrice,
  PLAN_URL_PARAM,
  priceOfNth,
  type UnlockCostRates
} from "@/contract/passivesPlan";
import { isKnown, type Pending } from "@/contract/pending";
import { PASSIVE_TREE_VOCABULARY } from "@/contract/passiveTreeVocabulary";
import type { ElementId } from "@/contract/types";
import { PathBrowse } from "./PathBrowse";
import { PathLattice } from "./PathLattice";
import { PlanPanel, type ClosePreviewOutcome } from "./PlanPanel";
import { TraitDetail } from "./TraitDetail";

/** Reads the `?plan=` param off the CURRENT address, once, for the initial state seed -- GG-8's own
 * "the address is stage + open layers" read the other direction: a cold load (or a pasted bookmark)
 * restores whatever Plan the URL names, as a DRAFT, never committed (§5.3). Raw `URLSearchParams`
 * rather than `react-router-dom`'s `useSearchParams` on purpose: `PassivesTab` mounts several
 * navigation levels deep inside whichever Router the host app provides, and every existing
 * `PassivesTab.test.tsx` case renders it with no Router at all -- the plain DOM API gives the exact
 * same GG-8 contract (the address bar reflects state, a reload restores it) without requiring a
 * Router context this component has never needed for anything else. */
function readPlanFromUrl(): Record<string, number> {
  if (typeof window === "undefined") return {};
  return decodePlanCode(new URLSearchParams(window.location.search).get(PLAN_URL_PARAM) ?? "");
}

/**
 * actor-sheet program, passive-tree I3/I4 — Level 0 ("Yours") and Level 1 ("All paths"),
 * spec-tree-surface.md §2.2. Still the Passives TAB of the actor sheet, never a route (GG-1) — this
 * replaces the four `LockedGridSlot`s that stood in for it (that placeholder's own comment, "this
 * game doesn't have PoE's content scale to justify [a node-graph tree]," is now false: the shared
 * corpus alone is above PoE's ~1,300 nodes, §2.1's own correction). §2.2: "Levels 0 and 1 are tabs
 * inside the Passives tab, not pushes" — `subTab` below is that inner tab bar. Levels 2/3 (the
 * lattice, the trait detail) are I6/I7 — `openTreeId`/`openNodeId` are that two-deep push stack.
 */
type PassivesSubTab = "yours" | "all";

export function PassivesTab({
  elementTyping
}: {
  /** ActorView.elementTyping (contract/types.ts) — feeds Level 1's element-match bucket (§7.3/§2.2
   * bucket 3). Optional and treated as "no match" when omitted or still Pending: this tab is also
   * exercised without an actor's own resolved element (e.g. PassivesTab.test.tsx's existing I3
   * cases), and a Pending value must never be read as a fabricated match. */
  elementTyping?: Pending<{ primary: ElementId; secondary?: ElementId }>;
}) {
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 0;
  const tree = usePassiveTree(playerId);
  const aptitudes = useAptitudes(playerId);
  const souls = useSoulBalance(playerId);
  const saveTreeNodes = useSaveTreeNodes();
  const previewTree = usePreviewTree();

  // §2.2's inner tab bar, plus I4's search/category query for Level 1 — both lifted here (not into
  // PathBrowse's own state) so they survive PathBrowse itself unmounting when `subTab` flips back to
  // "yours" and forward again, and survive the whole actor sheet closing and reopening while this
  // tab stays selected (GG-51 — same reasoning `CreaturesLayer.tsx`'s own T27 comment gives for why
  // plain `useState` already satisfies "survives a close/reopen": the owning component instance
  // doesn't unmount, only what's drawn from it does).
  const [subTab, setSubTab] = useState<PassivesSubTab>("yours");
  const [browseQuery, setBrowseQuery] = useState<PathBrowseQuery>(EMPTY_PATH_BROWSE_QUERY);
  // I6 -- Level 2 is a PUSH (§2.2: "sheet(1) -> path(2) -> trait(3)"), not a third sub-tab: opening a
  // path replaces the Level 0/1 tab body entirely rather than becoming a sibling of "Yours"/"All
  // paths." `null` means neither level 2 nor 3 is open.
  const [openTreeId, setOpenTreeId] = useState<string | null>(null);
  // I7 -- Level 3, pushed from Level 2 the SAME way Level 2 is pushed from Level 0/1 (one more state
  // slot on the exact same pattern, never a parallel navigation mechanism). Cleared whenever Level 2
  // itself closes (see `setOpenTreeId` below) so the sheet can never reopen mid-trait on a stale id.
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);

  // I8 -- the Plan (spec-tree-surface.md §5.1): a SPARSE overlay of nodes this session has touched
  // (a new Unlock, or a depth edit), lifted to THIS component's own scope so it outlives Level 2/3's
  // own panels closing -- the same GG-51 "the owning instance doesn't unmount" reasoning `subTab`/
  // `browseQuery` above already rely on, extended past a reload via the URL (below).
  const [plan, setPlan] = useState<Record<string, number>>(readPlanFromUrl);

  // I8's follow-up (spec-tree-surface.md §7.2 part 5) -- the Plan panel's "what would this close"
  // tool. A hypothetical aptitude id/delta the player is trying, plus the last preview result --
  // never persisted, and reset whenever the Plan itself reverts (`revertPlan` below) so a stale
  // sentence from a discarded draft can't linger.
  const [previewAptitudeId, setPreviewAptitudeId] = useState<string | undefined>(undefined);
  const [previewDelta, setPreviewDelta] = useState(0);
  const [previewResult, setPreviewResult] = useState<ClosePreviewOutcome | null>(null);

  // GG-8: the Plan round-trips through the URL for the current session or a bookmark -- nothing more.
  // Explicitly NOT a "share this build" feature (spec-tree-surface.md §15 Ask-first; this task's own
  // todo entry resolves that boundary): no share button, no marketing copy, no promise this code
  // still decodes after a future catalog revision. An empty plan removes the param entirely rather
  // than writing `?plan=`, so a fully-reverted actor's address bar looks exactly like it did before
  // any plan existed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const code = encodePlanCode(plan);
    if (code) url.searchParams.set(PLAN_URL_PARAM, code);
    else url.searchParams.delete(PLAN_URL_PARAM);
    window.history.replaceState(null, "", url.toString());
  }, [plan]);

  const isLoading = tree.isLoading || aptitudes.isLoading || souls.isLoading;
  const isError = tree.isError || aptitudes.isError || souls.isError;

  if (isLoading) {
    return (
      <p className="mt-4 text-sm text-muted" data-testid="passives-loading" aria-busy="true">
        Loading your paths…
      </p>
    );
  }

  if (isError) {
    return (
      <Banner tone="error" className="mt-4" data-testid="passives-error">
        Couldn't load your passive paths.
        <Button
          size="sm"
          variant="ghost"
          className="ml-2"
          onClick={() => {
            void tree.refetch();
            void aptitudes.refetch();
            void souls.refetch();
          }}
        >
          Retry
        </Button>
      </Banner>
    );
  }

  if (!tree.data || !aptitudes.data || !souls.data) {
    return <EmptyState testId="passives-pending" title="Loading your paths…" />;
  }

  const unspentAptitude = aptitudes.data.budget - aptitudes.data.spent;
  // I8's follow-up (§7.2 part 5) -- straight off the server's own aptitude wallet, never a
  // separately-hardcoded id list (`AptitudesPage.tsx`'s own established convention).
  const aptitudeIds = Object.keys(aptitudes.data.shares);
  const invested = investedTrees(tree.data.trees);
  const notWorking = notWorkingTraits(tree.data.trees);
  const focus = focusReading(tree.data.trees);
  const elementIds =
    elementTyping && isKnown(elementTyping)
      ? [elementTyping.value.primary, ...(elementTyping.value.secondary ? [elementTyping.value.secondary] : [])]
      : [];

  // I8 -- the merged view every lower level reads: server-committed values with the lifted Plan's own
  // edits layered on top (`mergeSoulLevels`), so a pending Unlock or depth change survives navigating
  // away and back. `cellStateFor`/owned-state derivation still reads the SERVER report only (GG-15:
  // committed truth is server truth) -- only the depth NUMBER shown is Plan-aware.
  const mergedSoulLevelByNodeId = mergeSoulLevels(tree.data.soulLevelByNodeId, plan);
  const dirty = Object.keys(plan).length > 0;

  // §5.2's price -- honestly absent (not zero, not guessed) when the wire hasn't shipped unlock-cost
  // rates yet (a pre-I8 server or a fixture). `unlockCost`/`price` stay `undefined` in that case and
  // the UI below renders no Plan panel and no per-node price, rather than a fabricated number.
  const unlockCost: UnlockCostRates | undefined =
    tree.data.unlockCostFirstPoints != null
      ? { firstPoints: tree.data.unlockCostFirstPoints, stepPoints: tree.data.unlockCostStepPoints ?? 0 }
      : undefined;
  const price = unlockCost ? planPrice(tree.data.soulLevelByNodeId, plan, unlockCost) : undefined;
  // The very next Unlock's own price, INCLUDING whatever new nodes the Plan already pending -- D25's
  // price depends on the ordinal alone, so each further pending unlock correctly costs more than the
  // last (`priceOfNth`, mirroring `TreeUnlockCost.PriceOfNth`).
  const nextUnlockPrice = unlockCost
    ? priceOfNth(
        Object.keys(tree.data.soulLevelByNodeId).length + planNewNodeIds(tree.data.soulLevelByNodeId, plan).length + 1,
        unlockCost
      )
    : undefined;

  // I9 (spec-tree-surface.md §5.1 item 2, §6) -- "what Focus would become" if the pending Plan were
  // committed right now. Recomputed from `mergedSoulLevelByNodeId` on every render (cheap at this
  // scale: a handful of trees, never memoized), so it moves live as the draft is edited (test 14) --
  // never the committed value `focus` above reads. Honestly absent (`undefined`, not a fabricated
  // 1200/500) when the wire hasn't shipped the concentration tuning dial yet.
  const focusPreview =
    tree.data.concentrationFmaxMilli != null && tree.data.concentrationWMilli != null
      ? draftFocusPreview(mergedSoulLevelByNodeId, {
          fmaxMilli: tree.data.concentrationFmaxMilli,
          wMilli: tree.data.concentrationWMilli
        })
      : undefined;

  function unlockNode(nodeId: string) {
    // B5 §1.1: "owned but not deepened" is soul level 0, a real state -- never skipped.
    setPlan((p) => ({ ...p, [nodeId]: 0 }));
  }
  function draftChange(nodeId: string, soulLevel: number) {
    setPlan((p) => ({ ...p, [nodeId]: soulLevel }));
  }
  function revertPlan() {
    // Save always commits the WHOLE draft (§4 rule 3), so reverting the Plan while a trait panel is
    // open needs to close that panel too -- otherwise TraitDetail's own already-seeded local draft
    // (seeded once, per its own `useAllocationDraft` contract) would keep showing the just-reverted
    // pending value until it next unmounts. Closing Level 2/3 forces a clean re-seed from the now-
    // clean merged values the next time either reopens.
    setPlan({});
    setOpenNodeId(null);
    setOpenTreeId(null);
    setPreviewResult(null);
  }

  // I8's follow-up (spec-tree-surface.md §7.2 part 5) -- runs the draft's own node set plus the one
  // hypothetical aptitude delta the player picked through the real server resolution
  // (`POST /api/passive-tree/{playerId}/preview`, never persisted), then diffs the response against
  // the already-fetched COMMITTED report (`closePreview`) -- a plain comparison of two server-resolved
  // outputs, never a re-derivation of `CrossUnlock`/`TierGate` here.
  async function runClosePreview() {
    // Falls back to the first available aptitude id, matching the SAME default `PlanPanel`'s own
    // Select already shows unasked (`previewAptitudeId ?? aptitudeIds[0]`) -- without this fallback,
    // clicking Preview before ever touching the dropdown would silently no-op against a visibly
    // selected id.
    const effectiveAptitudeId = previewAptitudeId ?? aptitudeIds[0];
    if (!effectiveAptitudeId || !tree.data) return;
    setPreviewResult(null);
    try {
      const result = await previewTree.mutateAsync({
        playerId,
        body: { nodes: mergedSoulLevelByNodeId, aptitudeDelta: { [effectiveAptitudeId]: previewDelta } }
      });
      setPreviewResult({ sentence: closePreviewSentence(closePreview(tree.data.trees, result.trees)) });
    } catch (err) {
      setPreviewResult({ error: err instanceof Error ? err.message : "Couldn't preview that change." });
    }
  }

  // I6 -- Level 2, pushed from either sub-tab. Falls through to the normal tab body if the selected
  // tree id no longer resolves (e.g. the catalog changed under it) rather than getting stuck open on
  // nothing.
  const openTree = openTreeId ? tree.data.trees.find((t) => t.treeId === openTreeId) : undefined;
  if (openTree) {
    // I7 -- Level 3, pushed from Level 2. Same fall-through safety: if the node id no longer resolves
    // (e.g. a retired node), render Level 2 rather than getting stuck on nothing.
    const openNode = openNodeId ? (openTree.nodes ?? []).find((n) => n.nodeId === openNodeId) : undefined;
    if (openNode) {
      return (
        <div className="mt-4 flex flex-col gap-3" data-testid="passives-tab">
          {price ? (
            <PlanPanel
              price={price}
              dirty={dirty}
              onRevert={revertPlan}
              focus={focusPreview}
              aptitudeIds={aptitudeIds}
              previewAptitudeId={previewAptitudeId}
              onPreviewAptitudeIdChange={setPreviewAptitudeId}
              previewDelta={previewDelta}
              onPreviewDeltaChange={setPreviewDelta}
              onRunPreview={runClosePreview}
              isPreviewing={previewTree.isPending}
              previewResult={previewResult}
            />
          ) : null}
          <TraitDetail
            node={openNode}
            report={openTree}
            soulLevelByNodeId={tree.data.soulLevelByNodeId}
            initialSoulLevelByNodeId={mergedSoulLevelByNodeId}
            isSaving={saveTreeNodes.isPending}
            onSaveNodes={async (nodes) => {
              const result = await saveTreeNodes.mutateAsync({ playerId, nodes });
              return result.trees;
            }}
            onBack={() => setOpenNodeId(null)}
            onDraftChange={draftChange}
            onCommitted={() => setPlan({})}
          />
        </div>
      );
    }

    return (
      <div className="mt-4 flex flex-col gap-3" data-testid="passives-tab">
        {price ? (
          <PlanPanel
            price={price}
            dirty={dirty}
            onRevert={revertPlan}
            focus={focusPreview}
            aptitudeIds={aptitudeIds}
            previewAptitudeId={previewAptitudeId}
            onPreviewAptitudeIdChange={setPreviewAptitudeId}
            previewDelta={previewDelta}
            onPreviewDeltaChange={setPreviewDelta}
            onRunPreview={runClosePreview}
            isPreviewing={previewTree.isPending}
            previewResult={previewResult}
          />
        ) : null}
        <PathLattice
          tree={openTree}
          soulLevelByNodeId={mergedSoulLevelByNodeId}
          reqScalePoints={tree.data.tierReqScalePoints ?? 0}
          actorTheta={aptitudes.data.theta}
          onOpenNode={setOpenNodeId}
          onBack={() => {
            setOpenTreeId(null);
            setOpenNodeId(null);
          }}
          nextUnlockPrice={nextUnlockPrice}
          onUnlock={unlockNode}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4" data-testid="passives-tab">
      {price ? (
        <PlanPanel
          price={price}
          dirty={dirty}
          onRevert={revertPlan}
          focus={focusPreview}
          aptitudeIds={aptitudeIds}
          previewAptitudeId={previewAptitudeId}
          onPreviewAptitudeIdChange={setPreviewAptitudeId}
          previewDelta={previewDelta}
          onPreviewDeltaChange={setPreviewDelta}
          onRunPreview={runClosePreview}
          isPreviewing={previewTree.isPending}
          previewResult={previewResult}
        />
      ) : null}
      <TabList
        testId="passives-sub-tabs"
        tabs={[
          { id: "yours", label: "Yours", testId: "passives-sub-tab-yours" },
          { id: "all", label: "All paths", testId: "passives-sub-tab-all" }
        ]}
        value={subTab}
        onChange={(id) => setSubTab(id as PassivesSubTab)}
      />

      {subTab === "all" ? (
        <PathBrowse
          trees={tree.data.trees}
          elementIds={elementIds}
          query={browseQuery}
          onQueryChange={setBrowseQuery}
          onOpen={setOpenTreeId}
        />
      ) : (
        <>
          {invested.length === 0 ? (
            <EmptyState
              testId="passives-empty"
              title={`You have ${unspentAptitude} ${PASSIVE_TREE_VOCABULARY.currency.aptitudePoints}.`}
              hint="Pick a path to open your first tier."
              action={
                <Button size="sm" variant="ghost" data-testid="passives-browse-affordance" onClick={() => setSubTab("all")}>
                  Browse all paths
                </Button>
              }
            />
          ) : (
            <section data-testid="passives-invested">
              <p className="text-2xs font-bold uppercase tracking-wide text-muted">Your paths</p>
              <ul className="mt-1 flex flex-col gap-1">
                {invested.map((t) => (
                  <li key={t.treeId} data-testid={`passives-invested-${t.treeId}`}>
                    <button
                      type="button"
                      className="text-left text-sm text-text hover:underline"
                      onClick={() => setOpenTreeId(t.treeId)}
                    >
                      <span className="font-display">{t.treeId}</span> — tier {t.tierReached} of {t.tiers}
                      {t.lenderTreeId ? <span className="text-xs text-muted"> · lent by {t.lenderTreeId}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {focus ? (
            <p className="text-xs text-muted" data-testid="passives-focus">
              <span className="font-bold text-text">Focus</span> — your commitment sits across about{" "}
              {focus.effectivePaths} {focus.effectivePaths === 1 ? "path" : "paths"}. Path bonuses ×
              {focus.multiplier.toFixed(2)}.
            </p>
          ) : null}

          <NotWorkingCount traits={notWorking} />

          <section data-testid="passives-currencies">
            <p className="text-2xs font-bold uppercase tracking-wide text-muted">Unspent</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm text-text">
              <li data-testid="passives-currency-aptitude">
                {unspentAptitude} {PASSIVE_TREE_VOCABULARY.currency.aptitudePoints} — opens a tier
              </li>
              <li data-testid="passives-currency-skill">
                {tree.data.skillPointsAvailable} {PASSIVE_TREE_VOCABULARY.currency.skillPoints} — buys a trait
              </li>
              <li data-testid="passives-currency-souls">
                {souls.data.balance} {PASSIVE_TREE_VOCABULARY.currency.souls} — deepens a trait
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * §8, point 1: "A count on Level 0, always visible when non-zero… Clicking it filters to exactly
 * those." Level 2 (the lattice a click would normally jump into) is I6, not built yet, so this
 * expands the exact filtered list inline rather than navigating anywhere — the filter itself is real
 * and exact, only the destination is deferred.
 */
function NotWorkingCount({ traits }: { traits: NotWorkingTrait[] }) {
  const [expanded, setExpanded] = useState(false);
  if (traits.length === 0) return null;

  return (
    <section data-testid="passives-not-working">
      <button
        type="button"
        className="text-left text-sm font-bold text-bad"
        data-testid="passives-not-working-count"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {traits.length} of your traits {traits.length === 1 ? "is" : "are"} not working
      </button>
      {expanded ? (
        <ul className="mt-1 flex flex-col gap-1" data-testid="passives-not-working-list">
          {traits.map((t) => (
            <li
              key={t.nodeId}
              className="border-l-2 border-bad pl-2 text-xs text-text"
              data-testid={`passives-not-working-${t.nodeId}`}
              data-kind={t.reason}
            >
              <span className="font-bold text-bad">Not working</span> — {t.treeId} ·{" "}
              {t.reason === "nullified" ? `switched off by ${t.winnerNodeId}` : "the gate that opened it has since closed"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
