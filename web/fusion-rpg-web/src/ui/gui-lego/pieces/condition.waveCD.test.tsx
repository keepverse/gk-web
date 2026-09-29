import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, waitFor } from "@testing-library/react";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import { createConditionSurfaceBus } from "@/features/gui-lego/conditionSurfaceBus";
import { foldConditionSurfaceVm } from "@/features/gui-lego/foldConditionSurfaceVm";
import { clearPieceRegistryForTests } from "@/features/gui-lego/pieceRegistry";
import { clearRecipeRegistryForTests, getRecipe } from "@/features/gui-lego/recipeRegistry";
import { known, pendingWithReason } from "@/contract/pending";
import { PLAYER_PENDING } from "@/contract/adapt";
import type { ActorView } from "@/contract/types";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import { RecipeMount } from "@/ui/gui-lego/RecipeMount";
import { ensureConditionGuiLegoRegistered } from "@/ui/gui-lego/registerCondition";
import { resetDerivedPiecesRegistrationFlagForTests } from "@/ui/gui-lego/pieces/register";
import { asSurfaceBusLike } from "@/features/gui-lego/createSurfaceBus";
import feRecipe from "@/ui/gui-lego/recipes/condition-console.json";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../../../");
const designRecipe = JSON.parse(
  readFileSync(resolve(repoRoot, "docs/design/gui-lego/recipes/condition-console.json"), "utf8")
);
const conditionConsoleCss = readFileSync(resolve(here, "../conditionConsole.css"), "utf8");
function actor(): ActorView {
  return {
    instanceId: "a1",
    playerId: 1,
    side: "plant",
    typeId: 3,
    displayName: known("Emberling"),
    phase: "ActiveBound",
    level: 14,
    xp: 2140,
    xpToNext: pendingWithReason(PLAYER_PENDING.xpToNext),
    revision: 1,
    channelSummary: pendingWithReason(PLAYER_PENDING.channelSummary),
    elementTyping: pendingWithReason(PLAYER_PENDING.elementTyping),
    shieldStack: pendingWithReason(PLAYER_PENDING.shieldStack),
    equipSlots: pendingWithReason(PLAYER_PENDING.equipSlots)
  };
}

function hotSheet() {
  return {
    instanceId: "a1",
    playerId: 1,
    side: "plant" as const,
    typeId: 3,
    displayName: "Emberling",
    speciesName: "Sunflower",
    phase: "ActiveBound",
    level: 14,
    xp: 2140,
    xpToNext: 3400,
    elementTyping: { primary: "fire" as const, secondary: "light" as const },
    standing: {
      offense: 77,
      survivability: 58,
      control: 36,
      utility: 26,
      economy: 49
    },
    resourcePools: [
      { resourceId: "hp", current: 1240, max: 1800 },
      { resourceId: "stamina", current: 44, max: 60 },
      { resourceId: "hunger", current: 12, max: 40 },
      { resourceId: "spirit", current: 22, max: 40 },
      { resourceId: "qi", current: 8, max: 24 },
      { resourceId: "poise", current: 18, max: 20 }
    ],
    shieldSummary: { elementId: "ice", current: 1200, max: 2000, stacks: 2 },
    liveStatuses: [] as { statusId: string }[],
    derived: [],
    primary: []
  };
}

describe("condition-glance Wave C–D", () => {
  beforeEach(() => {
    clearPieceRegistryForTests();
    clearRecipeRegistryForTests();
    resetDerivedPiecesRegistrationFlagForTests();
    ensureConditionGuiLegoRegistered();
  });

  afterEach(() => {
    clearPieceRegistryForTests();
    clearRecipeRegistryForTests();
    resetDerivedPiecesRegistrationFlagForTests();
  });

  it("FE recipe stays in sync with design condition-console.json (shield + identity slots)", () => {
    expect(feRecipe).toEqual(designRecipe);
    const identity = (feRecipe as { root: { slots: { main: unknown[] } } }).root.slots.main[1] as {
      slots?: { phase?: { piece?: string }; elements?: { piece?: string } };
    };
    const hero = (feRecipe as { root: { slots: { main: unknown[] } } }).root.slots.main[2] as {
      slots?: { shield?: { piece?: string; bind?: string } };
    };
    expect(identity.slots?.phase?.piece).toBe("phase-badge");
    expect(identity.slots?.elements?.piece).toBe("element-badge");
    expect(hero.slots?.shield?.piece).toBe("shield-status");
    expect(hero.slots?.shield?.bind).toBe("shield");
  });

  it("closed bus catalog is exactly pool.select / status.open / retry", () => {
    const bus = createConditionSurfaceBus();
    const seen: string[] = [];
    const events = ["condition.pool.select", "condition.status.open", "condition.retry"] as const;
    for (const ev of events) {
      bus.on(ev, () => seen.push(ev));
    }
    bus.emit("condition.pool.select", { poolId: "hp" });
    bus.emit("condition.status.open", { statusId: "s1" });
    bus.emit("condition.retry", {});
    expect(seen).toEqual([...events]);
    // Type surface — only these three event names exist on the bus factory.
    expect(events).toHaveLength(3);
  });

  it("condition-layout CSS keeps 2×2 landmarks and stand-row top-aligned (radar auto + bars 1fr)", () => {
    expect(conditionConsoleCss).toMatch(/grid-template-areas:[\s\S]*"prog identity"[\s\S]*"hero stand"/);
    expect(conditionConsoleCss).toMatch(/\.stand-row\s*\{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/s);
    expect(conditionConsoleCss).toMatch(/\.stand-row\s*\{[^}]*align-items:\s*start/s);
    expect(conditionConsoleCss).toMatch(/\.cond-hero\s*\{[^}]*align-items:\s*flex-start/s);
    expect(conditionConsoleCss).toMatch(/\.standing-radar-chart[\s\S]*?width:\s*200px/);
    expect(conditionConsoleCss).toMatch(/\.progression-gauge \.track\s*\{[^}]*height:\s*14px/s);
    expect(conditionConsoleCss).not.toMatch(/grid-template-columns:\s*140px/);
    expect(conditionConsoleCss).not.toMatch(/minmax\(200px,\s*1fr\)/);
    expect(conditionConsoleCss).not.toMatch(/minmax\(160px/);
  });

  it("bindSurface omits shield + statusStrip when fold leaves them undefined", () => {
    const recipe = getRecipe("condition-console")!;
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: { ...hotSheet(), shieldSummary: null, liveStatuses: [] },
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 2
    });
    const plan = bindSurface(recipe, vm, { preferOverlay: false });
    const main = plan.root!.slots.main as import("@/features/gui-lego/types").MountNode[];
    const hero = main[2]!;
    const stand = main[3]!;
    expect(hero.slots.shield).toBeUndefined();
    const live = stand.slots.live as import("@/features/gui-lego/types").MountNode[];
    expect(live.map((n) => n.pieceId)).toEqual(["standing-bars"]);
  });

  it("gauges and radar stamp data-revision; standing-radar lazy-mounts recharts", async () => {
    const recipe = getRecipe("condition-console")!;
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: hotSheet(),
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 7
    });
    const plan = bindSurface(recipe, vm, { preferOverlay: false });
    const bus = asSurfaceBusLike(createConditionSurfaceBus());
    render(<RecipeMount plan={plan} bus={bus} />);

    expect(screen.getByTestId("condition-progression")).toHaveAttribute("data-revision", "7");
    expect(screen.getByTestId("condition-resource-hp")).toHaveAttribute("data-revision", "7");
    expect(screen.getByTestId("condition-hp-radial")).toHaveAttribute("data-revision", "7");
    expect(screen.getByTestId("condition-standing-radar")).toHaveAttribute("data-revision", "7");
    expect(screen.getByTestId("condition-resource-icon-hp")).toBeInTheDocument();
    expect(screen.getByTestId("shield-status")).toBeInTheDocument();
    expect(screen.getByTestId("phase-badge")).toBeInTheDocument();
    expect(screen.getByTestId("element-badge-fire")).toBeInTheDocument();

    const consoleEl = screen.getByTestId("condition-console");
    expect(consoleEl.querySelector('[data-grid-area="prog"]')).toBeTruthy();
    expect(consoleEl.querySelector('[data-grid-area="identity"]')).toBeTruthy();
    expect(consoleEl.querySelector('[data-grid-area="hero"]')).toBeTruthy();
    expect(consoleEl.querySelector('[data-grid-area="stand"]')).toBeTruthy();

    // The radar is a `lazy()` chunk (`condition.tsx:11`) behind a `Suspense`, so this is a dynamic
    // import plus recharts' own module cost — and the default 1s waitFor budget is short enough to
    // lose that race in a fully parallel full-suite run (the flake F13/F10 recorded: the same tree
    // failed 5 then 2 tests). The assertion is unchanged; only the budget for the import is.
    await waitFor(
      () => {
        expect(screen.getByTestId("standing-radar-chart")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
    const chart = screen.getByTestId("standing-radar-chart");
    expect(chart).toHaveAttribute("data-revision", "7");
    expect(chart).toHaveStyle({ width: "200px", height: "200px" });
    // Full axis labels in the radar tree — regression for Economy→“omy” clip.
    expect(chart.textContent).toContain("Economy");
    expect(chart.textContent).toContain("Survivability");
  });

  it("pool-radial uses themeResolved HP paint and ice shield ring", () => {
    const recipe = getRecipe("condition-console")!;
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: hotSheet(),
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    const plan = bindSurface(recipe, vm, { preferOverlay: false });
    const main = plan.root!.slots.main as import("@/features/gui-lego/types").MountNode[];
    const radial = (main[2]!.slots.radial as import("@/features/gui-lego/types").MountNode).payload;
    expect(radial.themeResolved?.paint?.accent).toBeTruthy();
    expect(radial.shieldThemeResolved?.paint?.accent).toBeTruthy();
    // Ice shield must not collapse to default fire red.
    expect(radial.shieldThemeResolved?.paint?.accent).not.toBe("#e7733f");
  });

  it("progression XP track stays visible at 0 XP and identity portrait is 72px", () => {
    const recipe = getRecipe("condition-console")!;
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: { ...hotSheet(), xp: 0, xpToNext: 3655, level: 80 },
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 3
    });
    const plan = bindSurface(recipe, vm, { preferOverlay: false });
    const bus = asSurfaceBusLike(createConditionSurfaceBus());
    render(<RecipeMount plan={plan} bus={bus} />);

    expect(screen.getByTestId("condition-xp-track")).toBeInTheDocument();
    const fill = screen.getByTestId("condition-xp-fill");
    expect(fill).toHaveStyle({ width: "0%" });
    expect(screen.getByTestId("condition-xp-count").textContent).toMatch(/0\s*\/\s*3,?655/);
    const portrait = screen.getByTestId("condition-identity-portrait");
    expect(portrait).toHaveAttribute("width", "72");
    expect(portrait).toHaveAttribute("height", "72");
  });
});
