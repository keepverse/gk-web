import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GG-50: "A surface that lists entities states its strategy at each order of magnitude." This is
 * that declaration, for every real collection surface — not just the one that needed fixing
 * (CreaturesLayer). A collection surface with no real path to unbounded growth doesn't need
 * virtualizing yet, but that has to be a checked claim, not an assumption nobody wrote down.
 */
type CollectionEntry =
  | { surface: string; strategy: "render-all" | "virtualize" | "search-first"; reason: string }
  | { surface: string; strategy: "unbounded-risk"; reason: string };

const COLLECTION_SURFACES: CollectionEntry[] = [
  {
    surface: "Creatures (CreaturesLayer roster list)",
    strategy: "virtualize",
    reason:
      "The one real unbounded-growth risk: a player binds creatures indefinitely over a long save. Renders all below 50, switches to @tanstack/react-virtual above it — proven at 10/100/1000 via e2e/volume-fixtures.spec.ts, including that scrolling actually windows rather than statically slicing"
  },
  {
    surface: "Relics (RelicsLayer held/equipped/storage lists)",
    strategy: "render-all",
    reason:
      "The real catalog is 4 relics total (RelicCatalog.cs, T14's own note: no acquisition system exists yet, every player holds the full catalog) — structurally cannot reach a magnitude where render-all costs anything. Revisit if/when a real acquisition system exists"
  },
  {
    surface: "Almanac — Creatures tab (CatalogPage)",
    strategy: "render-all",
    reason: "Bounded by the game's own fixed plant/zombie type roster — a real, small, closed set (the base game defines every entry, nothing grows this list at runtime)"
  },
  {
    surface: "Almanac — Recipes tab (RecipesPage)",
    strategy: "render-all",
    reason: "Bounded by the fusion recipe book's own real, closed set — recipes are authored content, not player-generated volume"
  },
  {
    surface: "Chronicle — Runs tab (MetricsPage)",
    strategy: "render-all",
    reason: "Legacy page (pre-refactor), unmodified per the wrap-not-rebuild pattern (T19) — out of this phase's scope to add a new strategy to"
  },
  {
    surface: "Chronicle — Growth tab (RpgProgressionPage ledger)",
    strategy: "search-first",
    reason: "Already real and pre-existing: server-side Pager with an `afterId` cursor (not a client-side render-all), the actual answer GG-50 asks for, just built before this refactor and left unchanged"
  },
  {
    surface: "Expeditions (ExpeditionsPage active/history lists)",
    strategy: "render-all",
    reason: "Bounded by real, small server-side caps: squad slots per tier and history sliced to the last 8 entries (ExpeditionsPage.tsx) — not client-unbounded"
  },
  {
    surface: "Pacts (PactsLayer bound-contract list)",
    strategy: "render-all",
    reason: "Bounded by the real contract-slot cap (ContractCapacityDto.maxSlots, a small, server-enforced number) — cannot grow past that cap"
  },
  {
    surface: "World Outliner (legion + sector rows)",
    strategy: "render-all",
    reason: "~28 rows at spec-world-outliner.md §8e.3's own target, bounded by the two available map tiers — not player-generated volume"
  },
  {
    surface: "World notification rail",
    strategy: "render-all",
    reason: "Structurally one resolved turn's notifications for one player (`worldLatestTurn`), the same one-turn bound as the playback keyframe rail; the visible toast stack is capped at three (Toasts.tsx's own VISIBLE_CAP)"
  },
  {
    surface: "World turn playback keyframe rail",
    strategy: "render-all",
    reason: "One turn's own transcript, discarded at the next (spec-world-playback.md) — revisit only if a single turn's entry count grows past roughly 300"
  },
  {
    surface: "World sector inspector — slot rows",
    strategy: "render-all",
    reason: "Four slots max in shipped content — SlotIndex tops out at 3 (spec-world-inspector.md) — a real, small, closed set per sector"
  },
  {
    surface: "World sector inspector — force rows",
    strategy: "render-all",
    reason: "Single-digit rows; enemy forces render as bands (ForceView's exact:false case), never per-unit rows, so there is no unbounded count to render at all (spec-world-inspector.md)"
  },
  {
    surface: "Passives — Level 1 path browse (PathBrowse)",
    strategy: "virtualize",
    reason:
      "39 real shared paths today (spec-tree-surface.md §9.1: 12 primary + 6 elemental + 21 status), already above CreaturesLayer's own render-all threshold and the surface's own I4 acceptance names windowing explicitly -- proven at 10/100/1000 via e2e/fixtures/passive-tree-volume.ts's passiveTreePathBrowseFixture, the same generator I1 built ahead of this task"
  },
  // party-dungeon D5.12 — the Delve's own real collection surfaces (spec-delve-stage.md §7's band
  // table read in full first). Not every band-2 panel qualifies: GG-50 is about surfaces that render
  // an ACCUMULATED collection of entities (a roster, a carried-item grid, a history), not a fixed
  // menu of verbs a small closed enum drives. On that line, Talk (`offered`, the 8-value `WildVerb`
  // enum), Event (`choices`, a per-event menu), Object prompt (`verbs`, the 6-value closed vocabulary
  // in spec-dungeon-registries.md:78) and Supply (`SupplyView` has no list field at all — confirmed
  // by reading `contract/types.ts`'s own doc comment: "`SupplyUse.Use` is an *act*... not a listing
  // read") are deliberately excluded — none of them lists entities. The descent picker's own "found
  // domains" list is excluded for a sharper reason, not this one: `DomainOffers.For` is real on the
  // server (`DomainOffers.cs`), but no plural `DomainOfferView[]` (or any wrapping view) exists
  // anywhere in `contract/types.ts` yet — declaring a strategy for a surface with no declared wire
  // shape would be guessing, the same restraint `FightView`/`EventView`'s own `Pending` fields already
  // model. The four below each have a real, already-declared array field today (D5.2/D5.3/D5.4/D5.5
  // shipped), so a strategy is a real claim to check, not a placeholder.
  {
    surface: "Delve — Room graph (rooms and doors)",
    strategy: "render-all",
    reason:
      "DelveView.rooms/.doors (contract/types.ts), rendered by DelveGraph.tsx's plain DOM+SVG tree (D5.4, closed 2026-09-07) — one dungeon generation's own fixed room/door graph, discarded at the next descent, never accumulating across a save. The same 'one run's own transcript' bound World turn playback keyframe rail already uses, not a private rationale invented here"
  },
  {
    surface: "Delve — Pack (per-party carry grid)",
    strategy: "render-all",
    reason:
      "PackGrid.cs's own doc comment: '4x10 in every raid mode... a structural per-run limit, not a progression ceiling; the stash is uncapped. The grid never reads Theta and never grows with content depth' -- 40 cells, fixed by raid mode, matching Relics'/Pacts' own small-closed-catalog reasoning, not a new argument"
  },
  {
    surface: "Delve — Fight panel (initiative rail)",
    strategy: "render-all",
    reason:
      "Bounded by raid-modes.v1.json's own party cap (solo/pair/quad, 4 parties max) times a small per-party roster plus one room's own enemies -- a single fight's turn order, discarded when the fight ends, never an accumulating roster across a save. FightView.initiative (contract/types.ts) is still Pending -- D5.5 named no SignalR message shape exists yet -- so this declares the strategy ahead of the wiring, the same forward posture world-stage-map.md's own closing note describes ('if a later change makes one of these unbounded, its row is where that becomes visible')"
  },
  {
    surface: "Delve — Quest tracker (HUD)",
    strategy: "render-all",
    reason:
      "DelveView.quests: Pending<QuestView[]> (contract/types.ts), QuestDtoProjection.Project (spec-delve-quests.md) -- one delve run's own quest set, discarded at extraction exactly like the room graph above, never an accumulating list across a save"
  }
];

describe("volume matrix (GG-50)", () => {
  it("every entry states a real reason, not a placeholder", () => {
    for (const entry of COLLECTION_SURFACES) {
      expect(entry.reason.length, `${entry.surface} needs a real, non-empty reason`).toBeGreaterThan(20);
    }
  });

  it("the one surface with real unbounded growth risk declares virtualize, not render-all", () => {
    const creatures = COLLECTION_SURFACES.find((e) => e.surface.startsWith("Creatures"));
    expect(creatures?.strategy).toBe("virtualize");
  });

  it("declares the full known set", () => {
    expect(COLLECTION_SURFACES).toHaveLength(18);
  });

  it("the world stage adds no virtualize entry — every one of its five collections is structurally bounded", () => {
    const worldSurfaces = COLLECTION_SURFACES.filter((e) => e.surface.startsWith("World "));
    expect(worldSurfaces).toHaveLength(5);
    for (const entry of worldSurfaces) {
      expect(entry.strategy).toBe("render-all");
    }
  });

  it("virtualize is exactly Creatures and Passives' path browse — the world stage added neither", () => {
    const virtualized = COLLECTION_SURFACES.filter((e) => e.strategy === "virtualize");
    expect(virtualized).toHaveLength(2);
    expect(virtualized.map((e) => e.surface)).toEqual([
      expect.stringContaining("Creatures"),
      expect.stringContaining("Passives")
    ]);
  });

  it("Volume_matrix_declares_the_delve_collections", () => {
    // D5.12: four real delve collection surfaces (room graph, pack, fight initiative, quest
    // tracker) — see the classification comment above the array for why Talk/Event/Object
    // prompt/Supply and the descent picker's own domain list are NOT among them.
    const delveSurfaces = COLLECTION_SURFACES.filter((e) => e.surface.startsWith("Delve —"));
    expect(delveSurfaces).toHaveLength(4);
    expect(delveSurfaces.map((e) => e.surface)).toEqual([
      expect.stringContaining("Room graph"),
      expect.stringContaining("Pack"),
      expect.stringContaining("Fight panel"),
      expect.stringContaining("Quest tracker")
    ]);
    // None of the Delve's own surfaces needs virtualizing — every one is bounded by a structural,
    // per-run limit (a raid-mode cap, a fixed grid, one generated dungeon's own room count) rather
    // than an accumulating-across-a-save risk, the one property that has ever earned a `virtualize`
    // row in this table (Creatures, Passives' path browse). Declared here as a checked claim, not an
    // assumption: if a later change makes one of these unbounded, this is the test that goes red.
    for (const entry of delveSurfaces) {
      expect(entry.strategy, `${entry.surface} was expected to stay render-all`).toBe("render-all");
    }
  });

  it("Map_FE_files_are_untouched", () => {
    // The map front end is frozen for this program (spec-delve-stage.md §15: "UNTOUCHED:
    // src/stages/world/**, src/features/world/**, src/lib/bus/world.ts..."; §16: "the map FE
    // untouched"). A permanent regression guard, not a one-off manual check: it shells out to the
    // real `git status` against the real working tree, the same "compare against a fixed base ref"
    // approach spec-delve-stage.md's own Verify line asks for, since no in-repo precedent for a
    // git-backed test existed to match (checked: no other *.test.ts(x) under src/ shells out to
    // git). `--porcelain` catches both an edit to a tracked file AND a brand-new untracked file
    // under these paths — a `git diff`-only check would miss the latter.
    //
    // A prior party-dungeon task DID legitimately touch two of these three paths, on the record:
    // D1.28 (the map-door row — a filed, decision-2 exception, world-stage-map.md's own "Filed by
    // the party-dungeon program" section) and D5.4 (narrowing xyflowGuard.test.ts's scope to match
    // an already-ratified tech-stack.md amendment). Both are closed, both are fully described in
    // this repo's own tasks/party-dungeon-todo.md.
    //
    // A THIRD authorised exception sits here now: the notification-ssot program's owner-accepted ask
    // **A1** (2026-09-21) moved the world rail out of `src/stages/world/notify/**` and rewired
    // `WorldStage.tsx` onto the notification feed — recorded in
    // docs/architecture/notification-ssot-map.md §G0 (A1, Accepted) and tasks/notification-ssot-todo.md
    // NS5.7–NS5.11. Spec §15's own freeze line is stale a third time; filed as F12 in
    // tasks/party-dungeon-todo.md rather than patched into another program's spec from here. This
    // assertion is red only while that work is uncommitted, by design (it shells out to git). This repo commits by hand (AGENTS.md: git
    // hands-off), so that already-reviewed work can sit here, uncommitted, for a while — which is
    // exactly why this assertion reads real `git` state rather than a hardcoded snapshot: it goes
    // green the moment that work is committed, and it will not silently forgive anything landing
    // here later that was not.
    const repoRoot = join(__dirname, "..", "..", "..", "..");
    const protectedPaths = [
      "web/fusion-rpg-web/src/stages/world",
      "web/fusion-rpg-web/src/features/world",
      "web/fusion-rpg-web/src/lib/bus/world.ts"
    ];
    const output = execSync(`git status --porcelain -- ${protectedPaths.join(" ")}`, {
      cwd: repoRoot,
      encoding: "utf8"
    });
    expect(output.trim(), "the map FE must carry no diff from the last commit").toBe("");
  });
});
