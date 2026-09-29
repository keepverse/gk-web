#!/usr/bin/env node
// Generates src/theme/tokens.css from docs/design/_kit/tokens.css (T7).
// The kit is the source of truth for the design plates; this file used to
// be hand-retyped alongside it and had drifted — most importantly two real
// accessibility fixes already recorded in the kit (--warn and --bad raised
// to WCAG AA, see the kit's own comments) had never been ported into the
// shipped app. Run `node scripts/gen-tokens.mjs` after editing the kit;
// `node scripts/gen-tokens.mjs --check` (used by the test suite) fails if
// the committed file no longer matches what this would produce.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..", "..");
export const KIT_PATH = path.join(repoRoot, "docs", "design", "_kit", "tokens.css");
export const OUTPUT_PATH = path.join(scriptDir, "..", "src", "theme", "tokens.css");

// Kit token name -> Tailwind v4 theme namespace. A name not listed here
// (band-*, dur-*, ease-*, icon-*, control-h, meter-h, cjk, lh-*) is emitted
// as a bare custom property instead — it's consumed via var(), not meant to
// generate a Tailwind utility class.
const COLOR_NAMES = new Set([
  "soil", "soil-raised", "panel", "panel-raised", "panel-inset", "scrim",
  "text", "muted", "faint", "ink-dark",
  "almanac", "lawn", "lawn-hot", "zombie", "sun",
  "ok", "warn", "bad", "bad-solid", "info",
  "border", "border-control", "border-strong",
  "el-fire", "el-ice", "el-air", "el-earth", "el-light", "el-dark", "el-omni",
  "side-plant", "side-zombie", "side-creature",
  "rarity-1", "rarity-2", "rarity-3", "rarity-4", "rarity-5",
  "rarity-chaff", "rarity-sprout", "rarity-grafted", "rarity-cultivated", "rarity-fused",
  "rarity-chimeric", "rarity-heirloom", "rarity-firstseed", "rarity-sunwoven", "rarity-almanac",
  "pw-offense", "pw-survivability", "pw-control", "pw-utility", "pw-economy"
]);

/** kit name -> [tailwind namespace prefix, kit-name -> tailwind-suffix mapper] */
function classify(name) {
  if (COLOR_NAMES.has(name)) return { theme: true, tailwindName: `color-${name}` };
  if (name.startsWith("font-")) return { theme: true, tailwindName: name };
  if (name.startsWith("text-")) return { theme: true, tailwindName: name };
  if (name.startsWith("sp-")) return { theme: true, tailwindName: `spacing-${name.slice(3)}` };
  if (name.startsWith("r-")) return { theme: true, tailwindName: `radius-${name.slice(2)}` };
  if (name.startsWith("sh-")) return { theme: true, tailwindName: `shadow-${name.slice(3)}` };
  return { theme: false };
}

export function parseKitRoot(kitCss) {
  const rootMatch = kitCss.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) throw new Error("gen-tokens: no :root block found in " + KIT_PATH);
  const body = rootMatch[1];
  const entries = [];
  const lineRe = /--([\w-]+):\s*([^;]+);(?:\s*\/\*.*?\*\/)?/g;
  let match;
  while ((match = lineRe.exec(body))) {
    entries.push({ name: match[1], value: match[2].trim() });
  }
  return entries;
}

function renderThemeBlock(entries) {
  const lines = entries
    .filter((e) => classify(e.name).theme)
    .map((e) => `  --${classify(e.name).tailwindName}: ${e.value};`);
  return lines.join("\n");
}

function renderBareBlock(entries) {
  const lines = entries
    .filter((e) => !classify(e.name).theme)
    .map((e) => `  --${e.name}: ${e.value};`);
  return lines.join("\n");
}

const BAND_CLASSES = ["stage", "scrim", "hud", "panel", "dialog", "toast", "system"]
  .map((b) => `.band-${b} { z-index: var(--band-${b}); }`)
  .join("\n");

const SAFE_AREA_CSS = `/* Notch / home-indicator insets (lawn HUD / commander bar T13). */
.safe-area-top {
  padding-top: max(0px, env(safe-area-inset-top, 0px));
}
.safe-area-bottom {
  padding-bottom: max(0px, env(safe-area-inset-bottom, 0px));
}
`;

const BOOT_CSS = `:root {
  color: var(--color-text);
  background: var(--color-soil);
  font-family: var(--font-ui);
  font-size: var(--text-md);
  line-height: var(--lh-body);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--color-soil);
  color: var(--color-text);
}

#root {
  min-height: 100vh;
}

button,
input,
select {
  font: inherit;
}

:focus-visible {
  outline: 2px solid var(--color-sun);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

export function generate() {
  const kitCss = readFileSync(KIT_PATH, "utf8");
  const entries = parseKitRoot(kitCss);
  return `/* GENERATED — do not hand-edit. Source: docs/design/_kit/tokens.css.
   Run \`node scripts/gen-tokens.mjs\` after changing the kit; \`node scripts/gen-tokens.mjs --check\`
   (wired into the test suite, T7) fails if this file has drifted from it. */
@import "tailwindcss";

@theme {
${renderThemeBlock(entries)}
}

/* Band stacking (GG-5) and other tokens the kit declares but that aren't a Tailwind
   utility axis — consumed via var(), not a generated class, except the six band-*
   classes below. Shell (band -1) has no token: it replaces the stage rather than
   stacking over it, so it never needs to coordinate z-order with anything else. */
:root {
${renderBareBlock(entries)}
}

${BAND_CLASSES}

${SAFE_AREA_CSS}
${BOOT_CSS}`;
}

function main() {
  const output = generate();
  const check = process.argv.includes("--check");
  if (check) {
    const current = readFileSync(OUTPUT_PATH, "utf8");
    if (current.replace(/\r\n/g, "\n") !== output.replace(/\r\n/g, "\n")) {
      console.error(
        `gen-tokens --check: src/theme/tokens.css has drifted from ${path.relative(repoRoot, KIT_PATH)}.\n` +
          "Run `node scripts/gen-tokens.mjs` to regenerate it."
      );
      process.exitCode = 1;
      return;
    }
    console.log("gen-tokens --check: clean — tokens.css matches the kit.");
    return;
  }
  writeFileSync(OUTPUT_PATH, output);
  console.log(`gen-tokens: wrote ${path.relative(repoRoot, OUTPUT_PATH)}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
