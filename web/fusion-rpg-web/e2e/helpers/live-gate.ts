/** True when live actor-hud E2E should run (vite dev + real injector). */
export function isLiveActorHudE2e(): boolean {
  if (process.env.ACTOR_HUD_LIVE_E2E === "1") return true;
  return process.argv.some((arg) => arg.includes("live-chromium"));
}
