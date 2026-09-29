// GG-38 (tech-stack.md §6): a Phaser-class game canvas loads with its stage, so the shell's boot path
// never pays for it. That is the only thing this script checks.
//
// There is no size budget here, by owner ruling 2026-09-16: this is a game, its bundle is huge by
// nature, and an entry-KB ceiling copied from lightweight-app advice is the "fat chunk ⇒ ban the
// library" reflex tech-stack.md §6 already refuses. Boot weight is optimized after measured player
// pain — never against a threshold, and never by deleting a fit library.
//
// Run after `npm run build` (or via `npm run build:check`) — reads the real build output.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const wwwroot = path.resolve(scriptDir, "../../../src/FusionRpg.Server/wwwroot");
const indexHtmlPath = path.join(wwwroot, "index.html");

if (!existsSync(indexHtmlPath)) {
  console.error(`check-bundle: ${indexHtmlPath} not found — run "npm run build" first.`);
  process.exit(1);
}

const indexHtml = readFileSync(indexHtmlPath, "utf8");
const entryMatch = indexHtml.match(/<script[^>]+type="module"[^>]+src="\.\/(assets\/[^"]+\.js)"/);
if (!entryMatch) {
  console.error("check-bundle: could not find the entry <script type=\"module\"> tag in index.html.");
  process.exit(1);
}

const entryRelativePath = entryMatch[1];
const entrySource = readFileSync(path.join(wwwroot, entryRelativePath), "utf8");

// WHEN a chunk loads, not how big it is. Match the library's own banner rather than the word: shell
// components named `PhaserIslandHost` / `PhaserSceneSwitchPocPage` legitimately put "Phaser" in the
// entry chunk without loading Phaser.
if (entrySource.includes("https://phaser.io")) {
  console.error(`check-bundle: "Phaser" found inside the entry chunk (${entryRelativePath}) — it must load with the lawn stage, not the shell.`);
  process.exit(1);
}

console.log(`check-bundle: Phaser is absent from the entry chunk (${entryRelativePath}) — OK`);

// Presentation libraries (recharts, @xyflow/react, lucide-react, motion) are deliberately NOT checked.
// tech-stack.md §6: this check "must not fail because presentation libraries exist in package.json or
// appear in a layer chunk". Two earlier versions of this file did exactly that — first asserting both
// packages absent from package.json (recharts was restored 2026-09-07, so every build failed), then
// asserting them absent from the entry chunk. Both were the banned reflex in a new shape.
