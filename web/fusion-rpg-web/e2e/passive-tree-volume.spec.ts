import { test, expect, type Page } from "@playwright/test";
import { fulfillJson, mockShell } from "./helpers/mock-shell";
import {
  passiveTreeLatticeFixture,
  passiveTreePathBrowseFixture,
  type PassiveTreePathFixtureEntry
} from "./fixtures/passive-tree-volume";

/**
 * I1 (spec-tree-surface.md §11, §14 tests 3 and 4): the volume-fixture harness for the passive-tree
 * player surface, built before that surface existed. I4 now builds `PathBrowse.tsx` (Level 1) --
 * this file, plus `e2e/fixtures/passive-tree-volume.ts`, IS the volume-fixture deliverable I1
 * promised; I4 completes it rather than replacing it, per that file's own instruction not to write
 * a parallel spec.
 *
 * `passiveTreePathBrowseFixture` still returns its own minimal placeholder shape (`pathId`, `name`,
 * `gateState`, `invested`) -- I2's real wire shape (`TreeResolveReport`) has more fields than that
 * generator was ever meant to carry, so `toReport` below adapts one entry to the real DTO shape at
 * the point of use rather than changing the shared generator (I1's own contract, and I4's task
 * framing: "reuse those fixtures, don't invent new ones" -- this calls the same generator, it does
 * not add a second one).
 */

function toReport(entry: PassiveTreePathFixtureEntry) {
  return {
    treeId: entry.pathId,
    category: "Primary",
    gateState: entry.gateState,
    tierReached: entry.invested ? 1 : 0,
    tiers: 10,
    aptitudePoints: entry.invested ? 10 : 0,
    contributingNodeIds: entry.invested ? [`skill.${entry.pathId}-t1-n0`] : [],
    invalidNodeIds: [],
    lenderTreeId: null,
    herfindahlMilli: 0,
    focusMilli: 1000,
    excludedNodes: []
  };
}

async function mockPassiveTree(page: Page, count: number) {
  const trees = passiveTreePathBrowseFixture(count).map(toReport);
  await page.route("**/api/passive-tree/**", (route) =>
    fulfillJson(route, {
      playerId: 1,
      catalogRevision: 1,
      soulLevelByNodeId: {},
      trees,
      skillPointsBudget: 0,
      skillPointsSpent: 0,
      skillPointsAvailable: 0
    })
  );
  await page.route("**/api/aptitudes/**", (route) =>
    fulfillJson(route, { theta: 0, budget: 0, spent: 0, withinBudget: true, shares: {} })
  );
}

async function openPassivesAllPaths(page: Page) {
  await page.goto("/#/actor-ladder-demo?mock=1");
  await page.getByTestId("actor-ladder-open-panel").click();
  await page.getByTestId("actor-sheet-tab-paths").click();
  await page.getByTestId("passives-sub-tab-all").click();
}

/** I6 — one real "might" tree carrying the real 40-node `passiveTreeLatticeFixture()` shape, at a
 * caller-chosen depth so both the "all 40 mount" and the "scrolls to depth, never tier 1" tests can
 * drive the SAME mock with different actor progress. */
async function mockPassiveTreeWithLattice(page: Page, opts: { tierReached: number; aptitudePoints: number }) {
  await page.route("**/api/passive-tree/**", (route) =>
    fulfillJson(route, {
      playerId: 1,
      catalogRevision: 1,
      soulLevelByNodeId: {},
      trees: [
        {
          treeId: "might",
          category: "Primary",
          gateState: "wired",
          tierReached: opts.tierReached,
          tiers: 10,
          aptitudePoints: opts.aptitudePoints,
          contributingNodeIds: [],
          invalidNodeIds: [],
          lenderTreeId: null,
          herfindahlMilli: 1000,
          focusMilli: 1000,
          excludedNodes: [],
          nodes: passiveTreeLatticeFixture("might")
        }
      ],
      skillPointsBudget: 0,
      skillPointsSpent: 0,
      skillPointsAvailable: 0,
      tierReqScalePoints: 5
    })
  );
  await page.route("**/api/aptitudes/**", (route) =>
    fulfillJson(route, { theta: 100, budget: 0, spent: 0, withinBudget: true, shares: {} })
  );
}

async function openMightLattice(page: Page) {
  await openPassivesAllPaths(page);
  await page.getByTestId("path-card-might").click();
  await expect(page.getByTestId("passives-lattice")).toBeVisible();
}

test.describe("Passive-tree path browse volume (GG-50, I4 test 3)", () => {
  test.beforeEach(async ({ page }) => {
    await mockShell(page);
  });

  test("at 10: renders every WIRED card directly (below the windowed threshold)", async ({ page }) => {
    await mockPassiveTree(page, 10);
    await openPassivesAllPaths(page);

    // The fixture keeps §9.1's real proportion (roughly a third unproduced, i % 3 === 0) so this
    // volume test exercises the collapsed gate-less bucket too, not just the ordered list -- of the
    // 10 fixture entries, 4 are unproduced (indices 0/3/6/9) and never become an ordered card at all
    // (§9.1 rule 3), leaving 6 wired cards rendered directly.
    await expect(page.getByTestId("path-browse-list-static")).toBeVisible();
    await expect(page.locator('[data-testid^="path-card-"]')).toHaveCount(6);
    await expect(page.getByTestId("path-browse-list")).toHaveCount(0);
    await expect(page.getByTestId("path-browse-gateless-count")).toHaveText("4");
  });

  test("at 100: switches to the windowed strategy — far fewer than 100 cards mount", async ({ page }) => {
    await mockPassiveTree(page, 100);
    await openPassivesAllPaths(page);

    const list = page.getByTestId("path-browse-list");
    await expect(list).toHaveAttribute("data-virtualized", "true");
    const mounted = await page.locator('[data-testid^="path-card-"]').count();
    expect(mounted).toBeLessThan(100);
  });

  test("at 1000: mounted card count stays flat, not 1000", async ({ page }) => {
    await mockPassiveTree(page, 1000);
    await openPassivesAllPaths(page);

    const list = page.getByTestId("path-browse-list");
    await expect(list).toHaveAttribute("data-virtualized", "true");
    // The real corpus is 39 shared paths (§9.1) so 1000 is a stress fixture, not a realistic count
    // -- the assertion is purely that the rendering strategy holds under scale (GG-50's own "states
    // its strategy at every order of magnitude"), not a specific mounted-count ceiling.
    const mounted = await page.locator('[data-testid^="path-card-"]').count();
    expect(mounted).toBeLessThan(1000);
  });
});

test.describe("Passive-tree lattice at the 1280x720 floor (GG-61, I6 test 4)", () => {
  test.beforeEach(async ({ page }) => {
    await mockShell(page);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("all 40 cells mount; the panel body scrolls, the shell does not", async ({ page }) => {
    // spec-tree-surface.md §2.3: "ten tier rows will not fit in the panel body at the 1280x720
    // floor, so the tier ladder scrolls" — this is the GG-61 measurement the spec says was written
    // after, not an eyeball.
    await mockPassiveTreeWithLattice(page, { tierReached: 6, aptitudePoints: 999 });
    await openMightLattice(page);

    // All 40 real cells mount directly -- GG-61, never GG-50's windowing.
    await expect(page.locator('[data-testid^="lattice-cell-"]')).toHaveCount(40);

    const shellBefore = await page.getByTestId("actor-panel").evaluate((el) => el.getBoundingClientRect().height);

    const body = page.getByTestId("path-lattice-body");
    const [scrollHeight, clientHeight] = await body.evaluate((el) => [el.scrollHeight, el.clientHeight]);
    expect(scrollHeight).toBeGreaterThan(clientHeight);

    // The shell's own outer height is unchanged by the lattice's own internal overflow.
    const shellAfter = await page.getByTestId("actor-panel").evaluate((el) => el.getBoundingClientRect().height);
    expect(Math.abs(shellAfter - shellBefore)).toBeLessThan(1);
  });

  test("opens scrolled to the player's own depth, never tier 1", async ({ page }) => {
    // §2.3 / §14 test 5: the actor's own invested depth here is tier 6 -- assert the initial scroll
    // position brings tier 6's row into view, not tier 1's (both rows are mounted -- GG-61 -- so
    // this is genuinely about the SCROLL POSITION, not about which rows exist).
    await mockPassiveTreeWithLattice(page, { tierReached: 6, aptitudePoints: 999 });
    await openMightLattice(page);

    await expect(page.getByTestId("lattice-tier-row-6")).toHaveAttribute("data-scroll-target", "true");
    await expect(page.getByTestId("lattice-tier-row-1")).not.toHaveAttribute("data-scroll-target");

    // The real scroll position, not an approximate bounding-box comparison (fragile against exact
    // row heights): the body's own scrollTop is set to (at most, clamped by the browser to the real
    // scrollable range) tier 6's row offset -- never left at 0, which is what "opens scrolled to
    // tier 1" would look like.
    const body = page.getByTestId("path-lattice-body");
    const row6 = page.getByTestId("lattice-tier-row-6");
    const [{ scrollTop, scrollHeight, clientHeight }, row6Offset] = await Promise.all([
      body.evaluate((el) => ({ scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight })),
      row6.evaluate((el) => (el as HTMLElement).offsetTop)
    ]);
    expect(row6Offset).toBeGreaterThan(0); // sanity: tier 6 really is further down than tier 1
    const maxScrollTop = scrollHeight - clientHeight;
    expect(scrollTop).toBeGreaterThan(0);
    expect(scrollTop).toBe(Math.min(row6Offset, maxScrollTop));
  });
});
