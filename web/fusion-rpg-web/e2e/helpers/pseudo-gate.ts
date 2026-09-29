/**
 * True when the pseudo-locale E2E gate should run.
 *
 * The pseudo locale is **dev-only by design**: `setLocale("pseudo")` returns early outside
 * `import.meta.env.DEV` (`src/i18n/index.ts:79-82`) and the debug hook that exposes it is stripped
 * from a production build — which is why the built preview bundle the default `chromium` project
 * serves cannot render it, and why this gate needs `vite dev` (the same switch shape
 * `live-gate.ts` uses).
 *
 * Opt-in, so the default project does not collect a spec that cannot pass there:
 *   npx playwright test e2e/story-scene-pseudo.spec.ts --project=pseudo-chromium
 */
export function isPseudoLocaleE2e(): boolean {
  if (process.env.PSEUDO_LOCALE_E2E === "1") return true;
  return process.argv.some((arg) => arg.includes("pseudo-chromium"));
}
