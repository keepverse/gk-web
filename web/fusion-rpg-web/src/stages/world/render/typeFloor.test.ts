import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * world-stage W49's type floor, enforced in the spirit of `ui/disabledReasonGuard.ts`: XAG 101's
 * 18px at 1080p scales to 12px at the declared 720p floor, and `--text-2xs` (10px) / `--text-xs`
 * (11px) both fall under it — `--faint` is decorative-only by its own token comment (3.22:1 on
 * `--panel`, below the 4.5:1 text minimum). None of the three may carry a fact a player reads off
 * the map (a sector's ownership, health, yield, a lane's cost, a slot's kind) — only the map's own
 * decorative chrome (grid lines, unlabelled hairlines) may use them, and none of those live in the
 * directories this test scans.
 */

const SCAN_ROOTS = [
  join(__dirname), // src/stages/world/render
  join(__dirname, "..", "..", "..", "ui", "world") // src/ui/world
];

const SCANNABLE_EXTENSIONS = new Set([".tsx"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

const BANNED_TEXT_CLASS = /\btext-(?:2xs|xs)\b/;
const BANNED_FAINT_CLASS = /\btext-faint\b/;
const BANNED_INLINE_VAR = /var\(--(?:text-2xs|text-xs|faint)\)/;

type Violation = { file: string; line: number; text: string };

function walk(rootDir: string, onFile: (filePath: string, relPath: string) => void): void {
  for (const entry of readdirSync(rootDir)) {
    const fullPath = join(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, onFile);
    } else if (SCANNABLE_EXTENSIONS.has(extname(fullPath)) && !TEST_FILE_PATTERN.test(entry)) {
      onFile(fullPath, relative(join(__dirname, "..", "..", ".."), fullPath).split("\\").join("/"));
    }
  }
}

function scanForSubFloorText(): Violation[] {
  const violations: Violation[] = [];
  for (const root of SCAN_ROOTS) {
    walk(root, (filePath, relPath) => {
      const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (BANNED_TEXT_CLASS.test(line) || BANNED_FAINT_CLASS.test(line) || BANNED_INLINE_VAR.test(line)) {
          violations.push({ file: relPath, line: index + 1, text: line.trim() });
        }
      });
    });
  }
  return violations;
}

/**
 * Finds every JSX opening tag's span in `text` — from `<Name` to its unnested closing `>` (or
 * `/>`), tracking `{...}` depth so a `>` inside an attribute expression doesn't end the tag early.
 * Mirrors `ui/disabledReasonGuard.ts`'s own tag scanner, so a glyph's `fontSize`/`text-[...]` is
 * caught even when the tag spans several lines.
 */
function findJsxOpenTags(text: string): Array<{ start: number; content: string }> {
  const tags: Array<{ start: number; content: string }> = [];
  const tagStart = /<[A-Za-z]/g;
  for (const match of text.matchAll(tagStart)) {
    const start = match.index!;
    let depth = 0;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (ch === ">" && depth === 0) {
        tags.push({ start, content: text.slice(start, i + 1) });
        break;
      } else if (ch === "<" && depth === 0 && i > start) break;
    }
  }
  return tags;
}

// A glyph that hardcodes its own font-size (px/rem/em, or an arbitrary Tailwind `text-[...]`
// value) opts out of the browser's own text-zoom scaling — the thing "glyphs scale with text to
// 200%" forbids. A glyph that only ever inherits an ambient `text-*` class scales because that
// class does.
const GLYPH_TAG = /aria-hidden="true"/;
const FIXED_FONT_SIZE = /fontSize\s*:|text-\[[0-9.]+(?:px|rem|em)\]/;

function scanForFixedSizeGlyphs(): Violation[] {
  const violations: Violation[] = [];
  for (const root of SCAN_ROOTS) {
    walk(root, (filePath, relPath) => {
      const text = readFileSync(filePath, "utf8");
      const lines = text.split(/\r?\n/);
      for (const tag of findJsxOpenTags(text)) {
        if (!GLYPH_TAG.test(tag.content) || !FIXED_FONT_SIZE.test(tag.content)) continue;
        const line = text.slice(0, tag.start).split("\n").length;
        violations.push({ file: relPath, line, text: lines[line - 1]?.trim() ?? "" });
      }
    });
  }
  return violations;
}

describe("typeFloor — map labels and glyphs never drop under the 720p floor (world-stage W49)", () => {
  it("no fact-bearing label resolves to --text-2xs, --text-xs or --faint", () => {
    expect(scanForSubFloorText()).toEqual([]);
  });

  it("no glyph hardcodes a font size that would opt it out of text-zoom scaling", () => {
    expect(scanForFixedSizeGlyphs()).toEqual([]);
  });
});

describe("typeFloor — fixture proof the scan actually catches a regression", () => {
  it("BANNED_TEXT_CLASS flags a real text-xs/text-2xs/text-faint usage", () => {
    expect(BANNED_TEXT_CLASS.test('className="text-xs text-text"')).toBe(true);
    expect(BANNED_TEXT_CLASS.test('className="text-2xs text-text"')).toBe(true);
    expect(BANNED_FAINT_CLASS.test('className="text-faint"')).toBe(true);
    expect(BANNED_TEXT_CLASS.test('className="text-sm text-text"')).toBe(false);
  });

  it("scanForFixedSizeGlyphs catches a glyph tag with an inline px size, spanning lines", () => {
    const rogue = '<span\n  style={{ fontSize: "10px" }}\n  aria-hidden="true"\n>foo</span>';
    const violations: Array<{ file: string; line: number }> = [];
    for (const tag of findJsxOpenTags(rogue)) {
      if (GLYPH_TAG.test(tag.content) && FIXED_FONT_SIZE.test(tag.content)) {
        violations.push({ file: "fixture", line: 1 });
      }
    }
    expect(violations).toHaveLength(1);

    const fine = '<span aria-hidden="true" className="text-sm">foo</span>';
    const fineViolations = findJsxOpenTags(fine).filter(
      (tag) => GLYPH_TAG.test(tag.content) && FIXED_FONT_SIZE.test(tag.content)
    );
    expect(fineViolations).toHaveLength(0);
  });
});
