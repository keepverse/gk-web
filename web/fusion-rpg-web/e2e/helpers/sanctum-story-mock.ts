import type { Page, Route } from "@playwright/test";

/**
 * The Sanctum mock both story-scene capture specs need: the shell responds, the database is empty,
 * and `stories[0].eligible` is **true** so `SanctumStage` opens the prologue.
 *
 * Shared rather than copied because the pseudo-locale gate and the T23 visual gate must photograph
 * the same surface — two mocks that drift would compare two different scenes and call it a
 * before/after. Extracted 2026-09-23 from `story-scene-visual.spec.ts` verbatim.
 */

export const health = {
  ok: true,
  injectorConnected: false,
  lastHeartbeatUtc: null,
  source: "none",
  simEnabled: false,
  ingestQueued: 0,
  lastFlushMs: 0,
  currentPlayerId: 1
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/**
 * Mock the shell with the prologue ELIGIBLE, so `SanctumStage` opens it. The one field that matters
 * is `stories[0].eligible` — `SanctumStage.tsx` looks up `rift-prologue` v1 and opens on `eligible`.
 * Everything else is the standard Sanctum mock (mirrors `sanctum.spec.ts` and the sibling spec).
 */
export async function mockSanctumWithEligibleStory(page: Page, opts: { ackOk?: boolean } = {}) {
  const ackOk = opts.ackOk ?? true;
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) =>
    fulfillJson(route, {
      items: [{ id: 1, name: "Default", createdUtc: "2026-01-01T00:00:00Z" }],
      currentPlayerId: 1
    })
  );
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, { playerId: 1, items: [] }));
  await page.route("**/api/runs", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/souls/**", (route) =>
    fulfillJson(route, {
      playerId: 1,
      balance: 500,
      earnedTotal: 500,
      spentTotal: 0,
      revision: 1,
      updatedUtc: "2026-01-01T00:00:00Z"
    })
  );
  await page.route("**/api/contracts/**", (route) =>
    fulfillJson(route, {
      contracts: [],
      capacity: { used: 0, total: 0, purchasedSlots: 0, nextSlotPrice: 0, canBuy: false, maxSlots: 0 },
      dailyTribute: 0,
      deployFloor: 0,
      loyaltyMax: 0
    })
  );
  await page.route("**/api/onboarding/**", (route) => {
    const url = route.request().url();
    if (url.includes("/ack") || url.includes("/stories/")) {
      return fulfillJson(route, ackOk ? { ok: true } : { ok: false }, ackOk ? 200 : 500);
    }
    return fulfillJson(route, {
      playerId: 1,
      playerLevel: 1,
      revision: 1,
      checkpoints: [],
      stories: [
        {
          storyId: "rift-prologue",
          version: 1,
          state: "unseen",
          outcome: null,
          eligible: true
        }
      ]
    });
  });
}

