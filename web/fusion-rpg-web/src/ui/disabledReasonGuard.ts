import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import type { GuardViolation } from "@/shell/bandGuard";

const SCANNABLE_EXTENSIONS = new Set([".tsx"]);
const SKIPPED_DIR_NAMES = new Set(["node_modules", "dist", "coverage"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

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

/**
 * Finds every JSX opening tag's span in `text` — from `<Name` to its unnested closing `>` (or
 * `/>`), tracking `{...}` depth so a `>` inside an attribute expression (`title={a > b ? x : y}`)
 * doesn't end the tag early. Only real tag starts count: `<Name` where `Name` is an identifier
 * character, never `</` (a closing tag) or a bare `<` used as a comparison operator in prose-free
 * code (those never have an identifier immediately after).
 */
function findJsxOpenTags(text: string): Array<{ start: number; end: number; content: string }> {
  const tags: Array<{ start: number; end: number; content: string }> = [];
  const tagStart = /<[A-Za-z]/g;
  for (const match of text.matchAll(tagStart)) {
    const start = match.index!;
    let depth = 0;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (ch === ">" && depth === 0) {
        tags.push({ start, end: i + 1, content: text.slice(start, i + 1) });
        break;
      }
      // A tag body never contains an un-nested `<` of its own (that would be the next tag) —
      // bail out rather than let one malformed match swallow the rest of the file.
      else if (ch === "<" && depth === 0 && i > start) break;
    }
  }
  return tags;
}

// A real JSX attribute named `disabled`: bare (`disabled` immediately followed by whitespace, the
// tag close, or another attribute) or an assignment (`disabled={...}` / `disabled="..."`).
const DISABLED_ATTR_PATTERN = /(^|\s)disabled(?=$|\s|\/?>|=)/;

// A reason the codebase actually uses for this: `title`/`aria-label`/`aria-describedby` on the
// same control (GG-55's "on hover, on focus" case).
const REASON_ATTR_PATTERN = /\b(title|aria-label|aria-describedby)\s*=/;

export function scanForUnexplainedDisabledControls(srcDir: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  walk(srcDir, (filePath) => {
    const relPath = relative(srcDir, filePath).split("\\").join("/");
    const text = readFileSync(filePath, "utf8");
    const lines = text.split(/\r?\n/);

    for (const tag of findJsxOpenTags(text)) {
      if (!DISABLED_ATTR_PATTERN.test(tag.content)) continue;
      if (REASON_ATTR_PATTERN.test(tag.content)) continue;

      const line = text.slice(0, tag.start).split("\n").length;
      violations.push({ file: relPath, line, text: lines[line - 1]?.trim() ?? "" });
    }
  });
  return violations;
}
