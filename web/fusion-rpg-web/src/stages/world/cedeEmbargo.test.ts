import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CEDE_ORDER_AVAILABLE } from "./inspector/cedeCapability";
import { NextTurnBlock } from "./inspector/NextTurnBlock";
import { maximalSector } from "./inspector/fixtures/maximalSector";

// Kept as a `.test.ts` file per this task's own stated filename (not `.tsx`) — `createElement`
// stands in for JSX so no syntax here needs the JSX-aware parser extension to switch.

/**
 * The cede embargo, self-retiring (world-stage W60). §8c.2's finding — *the economy's core tension
 * was a notification, not a decision* — is only fixed once a player can actually act on it; **no
 * surface in this program may say "choose what to release" until the engine's own vocabulary
 * carries a `cede` kind.** This reads that vocabulary directly from the real C# source rather than
 * trusting a literal, so the embargo lifts itself the moment the engine catches up — which,
 * unusually, had **already happened** by the time this test was first written (`world-commands` W24
 * landed `cede` earlier in this same program): the branch below that would enforce the embargo has
 * never actually run against a real repo state, but it stays in place as the guard against a future
 * regression (someone reverting W24, or forking a command list that drops `cede`).
 */
const WORLD_COMMAND_CS = join(__dirname, "..", "..", "..", "..", "..", "src", "FusionRpg.Core", "World", "Turn", "WorldCommand.cs");

function cedeInRealVocabulary(): boolean {
  const text = readFileSync(WORLD_COMMAND_CS, "utf8");
  const declaresCedeConstant = /\bCede\s*=\s*"cede"/.test(text);
  const allIncludesCede = /\bAll\s*=\s*\n?\s*new\[\]\s*\{[^}]*\bCede\b[^}]*\}/.test(text);
  return declaresCedeConstant && allIncludesCede;
}

const FORBIDDEN_PATTERNS = [/choose what to release/i, /release first/i];

const SCANNABLE_EXTENSIONS = new Set([".tsx", ".ts"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

function scanWorldSurfacesForForbiddenCopy(): Array<{ file: string; line: number; text: string }> {
  const violations: Array<{ file: string; line: number; text: string }> = [];
  const root = __dirname;
  const walk = (dir: string, relBase: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules") continue;
      const fullPath = join(dir, entry);
      const relPath = relBase ? `${relBase}/${entry}` : entry;
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath, relPath);
      } else if (SCANNABLE_EXTENSIONS.has(extname(fullPath)) && !TEST_FILE_PATTERN.test(entry)) {
        const lines = readFileSync(fullPath, "utf8").split(/\r?\n/);
        lines.forEach((line, index) => {
          if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(line))) {
            violations.push({ file: relPath, line: index + 1, text: line.trim() });
          }
        });
      }
    }
  };
  walk(root, "");
  return violations;
}

describe("cede embargo — reads the real engine vocabulary, not a literal (world-stage W60)", () => {
  const cedeAvailable = cedeInRealVocabulary();

  it("cedeCapability.ts's CEDE_ORDER_AVAILABLE matches the real WorldCommand.cs vocabulary", () => {
    expect(CEDE_ORDER_AVAILABLE).toBe(cedeAvailable);
  });

  if (!cedeAvailable) {
    it("no world surface (inspector, HUD, targeting) says 'choose what to release' or draws 'release first' while cede is absent", () => {
      expect(scanWorldSurfacesForForbiddenCopy()).toEqual([]);
    });
  } else {
    it("the pin renders for real, now that cede is in the vocabulary — the embargo has lifted", () => {
      render(
        createElement(NextTurnBlock, {
          sector: { ...maximalSector, willReleaseNextTurn: true },
          cedeOrderAvailable: CEDE_ORDER_AVAILABLE
        })
      );
      expect(screen.getByTestId("next-turn-pin-controls")).toBeInTheDocument();
    });
  }

  it("fixture proof: the scanner catches a real forbidden phrase and ignores everyday copy", () => {
    const rogue = 'export const x = "you can choose what to release this turn";\n';
    const fine = 'export const x = "here is what will be released next turn";\n';
    const matchesRogue = FORBIDDEN_PATTERNS.some((p) => p.test(rogue));
    const matchesFine = FORBIDDEN_PATTERNS.some((p) => p.test(fine));
    expect(matchesRogue).toBe(true);
    expect(matchesFine).toBe(false);
  });
});
