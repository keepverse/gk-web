/** True when live derived-sheet visual E2E should run (vite + real Server on :5088). */
export function isLiveDerivedSheetE2e(): boolean {
  if (process.env.DERIVED_SHEET_LIVE_E2E === "1") return true;
  return process.argv.some((arg) => arg.includes("derived-live-chromium") || arg.includes("derived-sheet-visual"));
}
