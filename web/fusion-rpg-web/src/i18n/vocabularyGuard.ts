import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import type { GuardViolation } from "@/shell/bandGuard";

const SCANNABLE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIPPED_DIR_NAMES = new Set(["node_modules", "dist", "coverage"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

/**
 * GG-41: developer surfaces keep engine vocabulary — the nine gated dev pages, the ungated but
 * pre-existing debug consoles this refactor deliberately left untouched rather than rewrite
 * (`LawnPage.tsx`'s Spawn/Inspector/Overlay-FX panels, `RosterPage.tsx`, both predate the layer
 * system and are legacy/debug tooling in substance even though neither sits behind the `dev` gate),
 * and this guard's own source (which has to name the banned words to forbid them).
 */
const ALLOW_LISTED_PREFIXES = [
  "dev/",
  "features/status/",
  "features/stats/",
  "features/pvz-activity/",
  "features/icon-dump/",
  "features/almanac-dump/",
  "features/cheats/",
  "features/sim/",
  "features/log/",
  "features/metrics/",
  "features/lawn/",
  "features/roster/",
  "stages/lawn/",
  // The Phaser game layer (hexGuard.ts already treats `game/` as its own rules zone for the same
  // reason: it's debug/inspector rendering over the live board, not player chrome) and the API
  // client layer (`lib/bus/`: pure fetch/query/mutation code, no JSX, field/param names here
  // mirror the real wire contract by necessity — never player copy).
  "game/",
  "lib/bus/",
  "i18n/vocabularyGuard.ts"
];

// GG-23's own forbidden list — engine/protocol/schema vocabulary that must never appear as
// player-facing copy. Matched as whole words so e.g. "Coldwind" or "revisions" (an unrelated
// plural) don't false-positive.
const BANNED_WORDS = [
  "typeId",
  "ptr",
  "Intent",
  "UniqueActor",
  "Cold",
  "mods_json",
  "Admit",
  "revision",
  "ingest queue",
  "matchKey",
  // D5.10 (spec-delve-stage.md §8, `:178-179`) — delve-stage's own ten. `once`/`many` are
  // deliberately NOT here: both are ordinary English (§8: "would false-positive across the
  // tree") and are covered instead by `stages/delve/labels.ts`'s `entryKindLabel` plus a
  // rendered-phrase test (`labels.test.ts`'s own `Entry_kind_renders_as_a_phrase_never_the_enum`),
  // not a banned-word entry.
  "bandDelta",
  "dangerBand",
  "PartyIndex",
  "Retired",
  "thetaOffset",
  "rungId",
  "delveId",
  "sectorId",
  "archetypeId",
  "perMille",
  // identity-rename T18 (owner rulings R9/R11/R12, IC-1b): the RETIRED player-facing names. Player
  // copy must not name them again — the story calls its leads by token, the guide and the front pages
  // were renamed, and this is what notices if one comes back through a component edit. Matched as
  // whole words in copy only, so an identifier (`commander:dave`, `PvzStatsPage`, `actor.penny.name`)
  // and the dev surfaces above stay untouched — the same copy-vs-code narrowing every other entry gets.
  "Rise of Summoner",
  "Crazy Dave",
  "Dave",
  "Penny",
  "Zomboss",
  "Plants vs. Zombies",
  "PvZ"
];

const BANNED_WORD_PATTERN = new RegExp(`\\b(${BANNED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`);

// GG-23's other half: engine SYMBOLS. `\b` is a word-character boundary and neither the power
// index's letter nor the per-mille sign is a word character, so putting either in BANNED_WORDS
// above is a silent no-op — the guard reports green over a page that shows them. They need their
// own list, matched with no boundaries at all.
//
// The copy-vs-code narrowing BANNED_WORDS needs (string literals and JSX text only) is deliberately
// NOT applied here, and the asymmetry is the point: `typeId` is a legitimate identifier, so the word
// list has to tell copy from code. These symbols are legitimate in neither — nothing in this tree
// names an identifier with them, and a per-mille value is `perMilleRatio` on the wire and a `%` on
// screen. So ANY occurrence outside a comment is a violation. That also closes the case both
// scanners miss: JSX text on its own line, with no tag beside it to bound it.
const BANNED_SYMBOLS = [
  "\u0398", // the power index — `ladderIndex` on the wire, a name on screen, never this letter
  "\u2030"  // per-mille — rendered as a percentage by formatPerMille; the raw sign is engine vocabulary
];

const BANNED_SYMBOL_PATTERN = new RegExp(`(${BANNED_SYMBOLS.join("|")})`);

// A banned word only counts when it could plausibly be rendered as text: inside a quoted string
// literal or JSX text content. A code identifier (`actor.typeId`, `const ptr = ...`, `type: string`)
// is fine — GG-23 forbids the *word appearing as copy*, not the field existing.
const STRING_LITERAL_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

// A literal assigned to one of these never renders — it's an internal identifier (a `<select>`
// option's real value, a DOM/React plumbing prop), not player copy. `title`/`placeholder`/
// `aria-label`/`alt` are deliberately absent: those genuinely render (a tooltip, a hint, an
// accessible name), so a banned word there is a real violation, not a false positive.
const NON_RENDERING_ATTR_PATTERN =
  /\b(value|id|key|name|htmlFor|className|class|type|role|href|src|to|path|testId)\s*=\s*$/;

// TypeScript generic type arguments (`useState<"level" | "typeId">(...)`) are never rendered —
// this is a type-level union of allowed values, not text. Detected structurally: a `<` opens a
// generic when it's immediately preceded by an identifier character (a JSX tag's `<` is always
// followed by an identifier, never preceded by one) and the bracketed content is quote-led.
const GENERIC_TYPE_ARGS_PATTERN = /\w<"[^>(]*>/;

// `export type X = "a" | "b" | ...;` is erased entirely at compile time — TypeScript emits no
// runtime code for a type alias, so a banned word appearing only inside one can never reach a
// player. Matched on the declaration keyword itself (not just "looks like a union"), so a real
// runtime `const type = "a" | "b"`-shaped value (there is no such JS syntax, but a lookalike
// string) is never accidentally exempted by resemblance alone.
const TYPE_ALIAS_DECLARATION_PATTERN = /^\s*(export\s+)?type\s+\w+(<[^=]*>)?\s*=/;

// A `case "X":` label compares its literal against the switch discriminant — it is a comparison
// value, never itself displayed, the same "identifier/comparison value, not player copy" shape
// NON_RENDERING_ATTR_PATTERN already applies to attribute values. Whatever the matching branch
// actually returns or renders is checked separately, on its own line, and stays a real violation.
const CASE_LABEL_PATTERN = /^\s*case\s+/;

function walk(rootDir: string, onFile: (filePath: string) => void): void {
  for (const entry of readdirSync(rootDir)) {
    if (SKIPPED_DIR_NAMES.has(entry)) continue;
    const fullPath = join(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, onFile);
    } else if (SCANNABLE_EXTENSIONS.has(extname(fullPath)) && !TEST_FILE_PATTERN.test(entry)) {
      onFile(fullPath);
    }
  }
}

/** GG-23: scans player-facing source for engine/protocol/schema words appearing inside string
 * literals or JSX text — the shape the rule's own "Testable as" line names — skipping developer
 * surfaces (GG-41) and `data-testid`/import lines, which are identifiers, not player copy. */
export function scanForBannedVocabulary(srcDir: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  walk(srcDir, (filePath) => {
    const relPath = relative(srcDir, filePath).split("\\").join("/");
    if (ALLOW_LISTED_PREFIXES.some((p) => relPath.startsWith(p) || relPath === p)) return;

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      if (line.includes("data-testid") || line.includes("data-test-id")) return;
      if (/^\s*import\s/.test(line) || /\bfrom\s+["']/.test(line)) return;
      if (GENERIC_TYPE_ARGS_PATTERN.test(line)) return;
      if (TYPE_ALIAS_DECLARATION_PATTERN.test(line)) return;
      if (CASE_LABEL_PATTERN.test(line)) return;

      // Engine symbols are checked against the whole line, for the reason given at BANNED_SYMBOLS:
      // never legitimate in source, so no copy-vs-code narrowing applies.
      if (BANNED_SYMBOL_PATTERN.test(line)) {
        violations.push({ file: relPath, line: index + 1, text: line.trim() });
        return;
      }

      // JSX text content: strip tags, check what's left between them.
      const jsxTextSegments = line.match(/>[^<>{]*</g) ?? [];
      for (const seg of jsxTextSegments) {
        const inner = seg.slice(1, -1);
        if (BANNED_WORD_PATTERN.test(inner)) {
          violations.push({ file: relPath, line: index + 1, text: line.trim() });
          return;
        }
      }

      // Quoted string literals. Template-literal `${...}` interpolations are stripped first —
      // `` `#${typeId}` `` renders as "#7" at runtime, never the word "typeId"; only the STATIC
      // parts of a literal are real candidate player copy. A literal assigned to a non-rendering
      // attribute (`value="typeId"` on an <option>) is skipped — the text between the tags is
      // the real rendered copy, already checked above.
      for (const match of line.matchAll(STRING_LITERAL_PATTERN)) {
        const literal = match[0];
        const before = line.slice(0, match.index);
        if (NON_RENDERING_ATTR_PATTERN.test(before)) continue;
        const staticParts = literal.startsWith("`") ? literal.replace(/\$\{[^}]*\}/g, "") : literal;
        if (BANNED_WORD_PATTERN.test(staticParts)) {
          violations.push({ file: relPath, line: index + 1, text: line.trim() });
          return;
        }
      }
    });
  });
  return violations;
}
