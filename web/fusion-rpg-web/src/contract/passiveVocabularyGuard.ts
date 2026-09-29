import { readFileSync } from "node:fs";
import type { GuardViolation } from "@/shell/bandGuard";

/**
 * passive-tree-todo.md I10 — enforces the naming-swap mechanism `passiveTreeVocabulary.ts` builds
 * (spec-tree-surface.md §15 "Ask first: Naming" / §4.1 / §17 Q1). Modeled on `vocabularyGuard.ts`'s
 * and `pendingCopyGuard.ts`'s static-scan pattern: read player-facing source as text, regex-scan for
 * forbidden content inside JSX text / string literals, skip comments and identifiers.
 *
 * Scoped to the SIX passive-tree contract modules and SIX passive-tree UI components, not the whole
 * tree (unlike `vocabularyGuard.ts`'s GG-23 scan) -- "souls" is also a live currency name in
 * `FusionPage.tsx`/`SanctumStage.tsx` for an unrelated system, and scanning those would be false
 * positives, not passive-tree defects. This module's naming decision is local to this surface.
 */
export const PASSIVE_TREE_SURFACE_FILES = [
  "contract/passivesYours.ts",
  "contract/passivesBrowse.ts",
  "contract/passivesLattice.ts",
  "contract/passivesTrait.ts",
  "contract/passivesPlan.ts",
  "contract/passivesBloodline.ts",
  "ui/actor/PassivesTab.tsx",
  "ui/actor/PathBrowse.tsx",
  "ui/actor/PathLattice.tsx",
  "ui/actor/TraitDetail.tsx",
  "ui/actor/PlanPanel.tsx",
  "ui/actor/BloodlineTree.tsx"
];

/** The vocabulary module itself has to spell these words out -- it is the one allowed place. */
const VOCABULARY_MODULE_PATH = "contract/passiveTreeVocabulary.ts";

const STRING_LITERAL_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

// Same non-rendering-attribute exemption `vocabularyGuard.ts`/`pendingCopyGuard.ts` already use --
// `data-testid`/`value=`/etc. never render, so a currency word living inside one is an identifier,
// not player copy.
const NON_RENDERING_ATTR_PATTERN =
  /\b(value|id|key|name|htmlFor|className|class|type|role|href|src|to|path|testId)\s*=\s*$/;

/**
 * §4.1: "The two [wallets] must never share the bare word points." §15's "Never" list makes this a
 * blanket rule, not just the ambiguity case -- so the bare word is banned everywhere on this surface,
 * one exception: it may follow "aptitude " or "skill " (the two phrases the vocabulary module itself
 * emits are still allowed to CONTAIN the word "points" -- what's banned is spelling the currency name
 * out again independent of that module, which rule 2 below already catches).
 */
const BARE_POINTS_PATTERN = /(?<!aptitude |skill )\bpoints\b/i;

/**
 * The five vocabulary strings, hardcoded literally anywhere on this surface OTHER than inside
 * `passiveTreeVocabulary.ts` itself, is exactly the defect I10 exists to prevent: a later name swap
 * would then have to hunt down a second (or third) copy instead of editing one file. Matched as
 * case-sensitive whole phrases/words so normal prose ("open a path", "the world") is never flagged.
 */
const HARDCODED_VOCABULARY_TERMS = [
  "aptitude points",
  "skill points",
  /\bsouls\b/,
  /\bUnlock\b/,
  /\bDepth\b/
];

function findHardcodedTerm(text: string): string | RegExp | null {
  for (const term of HARDCODED_VOCABULARY_TERMS) {
    const found = typeof term === "string" ? text.includes(term) : term.test(text);
    if (found) return term;
  }
  return null;
}

/**
 * Candidates are pulled from the places text actually RENDERS: JSX text between tags, quoted string
 * literals not assigned to a non-rendering attribute, and (via `strayJsxTextLine` below) a bare text
 * run on its own line -- never a raw identifier. A bare identifier (`const souls = useSoulBalance(
 * ...)`, `onUnlock`, `currentDepth`) is real code, not player copy, even though a whole-word regex
 * would otherwise match it -- `souls` the variable name is exactly as word-bounded as `souls` the
 * rendered noun, which is why this guard never scans a raw line without going through one of these
 * three extractors first.
 *
 * `vocabularyGuard.ts`'s own JSX-text pattern (`>[^<>{]*<`) treats ANY `{` as a hard stop -- it can
 * only ever match a text run with zero interpolations in it. That is a real, silent gap for THIS
 * guard's own subject matter: every one of I10's fixes is exactly "text plus an interpolated
 * vocabulary lookup" (`<p ...>Depth {cell.soulLevel}</p>`), so reusing that pattern unmodified would
 * make the guard blind to the one shape it exists to police. This version allows a single-level
 * `{...}` group to sit inside the run (matched, then stripped below) without breaking the match.
 */
const JSX_TEXT_PATTERN = />((?:[^<>{}]|\{[^{}]*\})*)</g;

function extractCandidateSegments(line: string): string[] {
  const segments: string[] = [];

  for (const match of line.matchAll(JSX_TEXT_PATTERN)) {
    segments.push(stripBraceExpressions(match[1]));
  }

  for (const match of line.matchAll(STRING_LITERAL_PATTERN)) {
    const literal = match[0];
    const before = line.slice(0, match.index);
    if (NON_RENDERING_ATTR_PATTERN.test(before)) continue;
    const staticParts = literal.startsWith("`") ? literal.replace(/\$\{[^}]*\}/g, "") : literal;
    segments.push(staticParts.slice(1, -1));
  }

  const stray = strayJsxTextLine(line);
  if (stray !== null) segments.push(stray);

  return segments;
}

/** Removes every `{...}` span (any nesting depth) -- an interpolation never renders its own braces,
 * only its evaluated value, so what is left is the literal text around it. */
function stripBraceExpressions(line: string): string {
  let result = "";
  let depth = 0;
  for (const ch of line) {
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      if (depth > 0) depth--;
      continue;
    }
    if (depth === 0) result += ch;
  }
  return result;
}

// A line left over after `stripBraceExpressions` that still contains one of these is a STATEMENT
// (an assignment, a call, a return, a keyword), not rendered prose -- `const souls = ...`,
// `souls: number;`, `return { ... };` all fail this after stripping, `opens at {n} aptitude points`
// passes it (nothing but words, spaces and punctuation survive the strip).
const CODE_LIKE_PATTERN = /[=;()<>]|\b(const|let|var|return|function|import|export|type|interface)\b/;

/**
 * The one gap `extractCandidateSegments`'s tag-bounded regex leaves (see the DISCLOSED LIMITATION
 * doc below): a JSX text run sitting on its OWN line, between a multi-line tag's `>` on one line and
 * its `<` on another -- exactly the shape this task's own edits use
 * (`opens at {distance.need} {V.currency.aptitudePoints} · you have {distance.have}` has neither
 * character on its line). Only applies when the line carries NO `<`/`>` at all -- a line that does is
 * either already handled by the tag-bounded match above, or is a JSX element/attribute line, not a
 * bare text run.
 */
function strayJsxTextLine(line: string): string | null {
  if (line.includes("<") || line.includes(">")) return null;
  const stripped = stripBraceExpressions(line);
  if (stripped.trim().length === 0) return null;
  if (CODE_LIKE_PATTERN.test(stripped)) return null;
  return stripped;
}

/**
 * Scans the fixed passive-tree file list (relative to `srcDir`, forward-slashed) for a bare "points"
 * or a hardcoded currency/track word reaching player-facing text outside `passiveTreeVocabulary.ts`.
 * A missing file (renamed, not yet created) is silently skipped -- this guard polices content in
 * files that exist, not the file list's own completeness.
 *
 * DISCLOSED LIMITATION: this is still a per-LINE scan (same as `vocabularyGuard.ts`/
 * `pendingCopyGuard.ts`), so player prose that word-wraps a banned term across two lines (rare in
 * this tree's short JSX text) would not be caught. `strayJsxTextLine` closes the one shape this
 * module actually produces -- a whole text run, interpolations included, on a single un-tagged
 * line -- but a hand-wrapped multi-line sentence is a real, if narrow, remaining gap.
 */
export function scanForHardcodedPassiveVocabulary(srcDir: string): GuardViolation[] {
  const violations: GuardViolation[] = [];

  for (const relPath of PASSIVE_TREE_SURFACE_FILES) {
    if (relPath === VOCABULARY_MODULE_PATH) continue;
    let text: string;
    try {
      text = readFileSync(`${srcDir}/${relPath}`, "utf8");
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      if (line.includes("data-testid") || line.includes("data-test-id")) return;
      if (/^\s*import\s/.test(line) || /\bfrom\s+["']/.test(line)) return;

      for (const segment of extractCandidateSegments(line)) {
        if (BARE_POINTS_PATTERN.test(segment) || findHardcodedTerm(segment)) {
          violations.push({ file: relPath, line: index + 1, text: trimmed });
          return;
        }
      }
    });
  }

  return violations;
}
