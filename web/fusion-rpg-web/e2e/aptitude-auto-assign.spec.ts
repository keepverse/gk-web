import { test, expect, type Page, type Route } from "@playwright/test";
import { mockShell, fulfillJson } from "./helpers/mock-shell";

/**
 * spec-auto-assign-control.md (EP1.20/EP1.21, CP2) — the producer W2 was missing, driven through
 * the real shell: the strip lists the rules the SERVER returns for the scope, choosing one emits
 * `aptitude.autoAssign` (which the console turns into a `POST /api/aptitude-presets/suggest`), the
 * result is a DRAFT only (C3: nothing persists before Confirm), and a refused rule shows its named
 * reason with `even` still on offer (C4).
 */

const FIXTURE_INSTANCE_ID = "fixture-actor-1";
const APTITUDE_IDS = [
  "Might",
  "Fortitude",
  "Vigor",
  "Onslaught",
  "Agility",
  "Composure",
  "Pierce",
  "Focus",
  "Bulwark",
  "Retribution",
  "Precision",
  "Ferocity"
] as const;

/** The server's saved allocation for the specimen (what a reload must still show). */
const SAVED_SHARES: Record<string, number> = Object.fromEntries(
  APTITUDE_IDS.map((id) => [id, id === "Might" ? 10 : 0])
);

/** A fill the server could return: unmistakably different from `SAVED_SHARES`. */
function fillShares(): Record<string, number> {
  return Object.fromEntries(APTITUDE_IDS.map((id) => [id, id === "Might" ? 17 : 7]));
}

const SERVER_RULES = [
  "active-preset",
  "species-favour",
  "posture-force",
  "posture-finesse",
  "posture-bastion",
  "even"
];

type SuggestBehaviour =
  /** A successful fill (200 with `draftShares`). */
  | { kind: "fill"; shares: Record<string, number> }
  /** A named refusal (400 with `reason`), the shape `runAutoAssign` surfaces as `result.reason`. */
  | { kind: "refuse"; reason: string };

/**
 * Mock the aptitudes console's two servers: the specimen's allocation (`/api/aptitudes/unique/**`)
 * and the preset API (rules list + suggest). `postCount` is what proves C3 — a draft that never
 * POSTs an allocation.
 */
async function mockConsole(page: Page, behaviour: SuggestBehaviour) {
  const state = { allocationPosts: 0, suggestBodies: [] as { rule?: string }[] };

  await page.route("**/api/aptitudes/unique/**", async (route) => {
    if (route.request().method() === "POST") state.allocationPosts += 1;
    await fulfillJson(route, {
      instanceId: FIXTURE_INSTANCE_ID,
      playerId: 1,
      specimenLevel: 10,
      budget: 200,
      spent: 10,
      leftover: 190,
      withinBudget: true,
      shares: SAVED_SHARES,
      theta: 10
    });
  });

  await page.route("**/api/aptitudes/**", (route) => {
    if (route.request().url().includes("/unique/")) return route.fallback();
    return fulfillJson(route, { theta: 100, budget: 300, spent: 0, withinBudget: true, shares: {} });
  });

  await page.route("**/api/aptitude-presets/**", async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/rules")) {
      const scope = new URL(url).searchParams.get("scope") ?? "";
      const rules = scope === "commander" ? SERVER_RULES.filter((id) => id !== "species-favour") : SERVER_RULES;
      await fulfillJson(route, { scope, rules });
      return;
    }
    if (url.includes("/active")) {
      await fulfillJson(route, {
        playerId: 1,
        scope: "unique",
        scopeKey: FIXTURE_INSTANCE_ID,
        presetId: null
      });
      return;
    }
    if (url.includes("/suggest") && method === "POST") {
      state.suggestBodies.push(route.request().postDataJSON() as { rule?: string });
      if (behaviour.kind === "refuse") {
        await fulfillJson(route, { reason: behaviour.reason }, 400);
        return;
      }
      const shares = behaviour.shares;
      await fulfillJson(route, {
        ruleId: (route.request().postDataJSON() as { rule?: string }).rule ?? "even",
        rows: [],
        skipped: [],
        draftShares: shares,
        leftover: 200 - Object.values(shares).reduce((a, b) => a + b, 0)
      });
      return;
    }
    if (url.includes("/favour/")) {
      await fulfillJson(route, { sharesPermille: {} });
      return;
    }
    await fulfillJson(route, {});
  });

  return state;
}

async function openAptitudesConsole(page: Page) {
  await mockShell(page);
  await page.goto("/#/actor-ladder-demo?mock=1");
  await page.getByTestId("actor-ladder-open-panel").click();
  await page.getByTestId("actor-sheet-tab-aptitudes").click();
  await expect(page.getByTestId("aptitudes-tab")).toHaveAttribute("data-mode", "unique");
}

test.describe("aptitude auto-assign control (EP1.21 / CP2)", () => {
  test("the strip lists the server's rules and choosing one changes the draft — nothing persists (C1/C2/C3)", async ({
    page
  }) => {
    const state = await mockConsole(page, { kind: "fill", shares: fillShares() });
    await openAptitudesConsole(page);

    // C1: one button per rule the server returned, in the server's order.
    const strip = page.getByTestId("auto-assign-rule-strip");
    await expect(strip).toBeVisible();
    await expect(strip.locator("button")).toHaveText([
      "Active preset",
      "Species favour",
      "Force posture",
      "Finesse posture",
      "Bastion posture",
      "Even split"
    ]);
    // Labels are the catalog's display names, not the raw engine ids.
    await expect(page.getByTestId("auto-assign-rule-species-favour")).toBeVisible();

    const before = await page.getByTestId("aptitude-value-Might").textContent();

    await page.getByTestId("auto-assign-rule-even").click();

    // The control emitted its rule onto the bus, which the console turned into one /suggest call.
    await expect.poll(() => state.suggestBodies.length).toBe(1);
    expect(state.suggestBodies[0]?.rule).toBe("even");

    // C2/C3: the draft changed, and it is a DRAFT — no allocation write happened.
    await expect(page.getByTestId("aptitude-value-Might")).not.toHaveText(before ?? "");
    expect(state.allocationPosts).toBe(0);
    await expect(page.getByTestId("allocate-decision-confirm")).toBeEnabled();
  });

  test("the draft is not persisted: reload shows the saved allocation unchanged (C3)", async ({ page }) => {
    const state = await mockConsole(page, { kind: "fill", shares: fillShares() });
    await openAptitudesConsole(page);

    const saved = await page.getByTestId("aptitude-value-Might").textContent();
    await page.getByTestId("auto-assign-rule-posture-force").click();
    await expect(page.getByTestId("aptitude-value-Might")).not.toHaveText(saved ?? "");
    expect(state.allocationPosts).toBe(0);

    await page.reload();
    await page.getByTestId("actor-ladder-open-panel").click();
    await page.getByTestId("actor-sheet-tab-aptitudes").click();

    await expect(page.getByTestId("aptitude-value-Might")).toHaveText(saved ?? "");
    expect(state.allocationPosts).toBe(0);
  });

  test("species-favour on a specimen's own species fills end to end (W3 closed)", async ({ page }) => {
    const state = await mockConsole(page, { kind: "fill", shares: fillShares() });
    await openAptitudesConsole(page);

    const before = await page.getByTestId("aptitude-value-Vigor").textContent();
    await page.getByTestId("auto-assign-rule-species-favour").click();

    await expect.poll(() => state.suggestBodies.length).toBe(1);
    expect(state.suggestBodies[0]?.rule).toBe("species-favour");
    await expect(page.getByTestId("aptitude-value-Vigor")).not.toHaveText(before ?? "");
    // The favour path filled the draft rather than writing an allocation (E3: favour never writes).
    expect(state.allocationPosts).toBe(0);
    await expect(page.getByTestId("toast-title")).toHaveCount(0);
  });

  test("a forced refusal shows its named reason and still offers `even` (C4)", async ({ page }) => {
    const state = await mockConsole(page, { kind: "refuse", reason: "autoAssign.favour.empty" });
    await openAptitudesConsole(page);

    const before = await page.getByTestId("aptitude-value-Might").textContent();
    await page.getByTestId("auto-assign-rule-species-favour").click();

    // Named reason, from the server's own `reason` field through the host's refusal toast.
    await expect(page.getByTestId("toast-title")).toHaveText("No species favour");
    await expect(page.getByTestId("toast-message")).toContainText("Even");

    // The refusal changed nothing, and the guaranteed fallback is still there to choose.
    await expect(page.getByTestId("aptitude-value-Might")).toHaveText(before ?? "");
    await expect(page.getByTestId("auto-assign-rule-even")).toBeVisible();
    await expect(page.getByTestId("auto-assign-rule-even")).toBeEnabled();
    expect(state.allocationPosts).toBe(0);
  });
});
