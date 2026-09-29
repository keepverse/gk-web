import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORLD_COMMAND_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "src",
  "FusionRpg.Core",
  "World",
  "Turn",
  "WorldCommand.cs"
);

const FORBIDDEN_PATTERNS: RegExp[] = [
  /choose what to release/i,
  /pick which sector/i,
  /select which ground/i,
  /choose which sector to (?:give up|abandon|release|cede)/i
];

function scanConfirmsForForbiddenCopy(): { file: string; text: string }[] {
  const violations: { file: string; text: string }[] = [];
  for (const entry of readdirSync(__dirname)) {
    if (!/\.tsx?$/.test(entry) || /\.(test|spec)\.[jt]sx?$/.test(entry)) continue;
    const text = readFileSync(join(__dirname, entry), "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) violations.push({ file: entry, text: pattern.source });
    }
  }
  return violations;
}

/**
 * world-stage W105 (spec-world-confirms.md §4, §5) — the scan reads `WorldCommandKinds` itself
 * rather than a flag, so it turns itself off the day the cede order lands, per the spec's own
 * design. **Real finding, 2026-09-05**: `WorldCommand.cs` already declares `Cede = "cede"` — a
 * concurrent `world-commands` stream landed the cede kind before this module's own override UI did.
 * The copy constraint's own precondition has therefore already flipped: a "choose what to release"
 * surface would no longer be a lie at the engine level. This is asserted explicitly below rather
 * than silently changing this test's behaviour, so a future reader sees the real state instead of
 * guessing why the guard stopped enforcing anything. `ReleaseGroundDialog.tsx` (W104) still never
 * offers that choice — it only names the one sector `LoamForecast.Weakest` already picked — so the
 * plain scan below stays meaningful and enforced regardless: it is testing this module's actual
 * copy today, not gating on the engine's own vocabulary.
 */
describe("Forbidden copy — 'choose what to release' (world-stage W105)", () => {
  it("WorldCommandKinds already declares a cede kind — the copy constraint's precondition has flipped", () => {
    const commandSource = readFileSync(WORLD_COMMAND_PATH, "utf8");
    const hasCedeKind = /public const string Cede\s*=\s*"cede"/.test(commandSource);
    expect(hasCedeKind).toBe(true);
  });

  it("no file in stages/world/confirms/ currently offers a choice of which sector to release", () => {
    expect(scanConfirmsForForbiddenCopy()).toEqual([]);
  });
});
