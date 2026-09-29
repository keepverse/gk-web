import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { dispatchGlobalVerb } from "@/shell/keymap";
import { useWorldVerbs, type WorldVerb } from "./worldVerbs";

function Harness({ verbs }: { verbs: readonly WorldVerb[] }) {
  useWorldVerbs(verbs);
  return null;
}

describe("useWorldVerbs — the stage's one verb-registration owner (world-stage W78)", () => {
  it("registers on mount and frees every key on unmount, so mounting twice never throws", () => {
    const handler = vi.fn();
    const verbs: WorldVerb[] = [{ key: "q", id: "world-test-verb", handler }];

    const first = render(<Harness verbs={verbs} />);
    expect(dispatchGlobalVerb("q")).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    first.unmount();

    // If unmount had not freed "q", this second mount would throw
    // ("already registered by world-test-verb").
    expect(() => render(<Harness verbs={verbs} />)).not.toThrow();
    expect(dispatchGlobalVerb("q")).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("registers every verb in the set, and frees all of them together", () => {
    const a = vi.fn();
    const b = vi.fn();
    const { unmount } = render(
      <Harness
        verbs={[
          { key: "y", id: "verb-a", handler: a },
          { key: "z", id: "verb-b", handler: b }
        ]}
      />
    );

    expect(dispatchGlobalVerb("y")).toBe(true);
    expect(dispatchGlobalVerb("z")).toBe(true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unmount();

    expect(dispatchGlobalVerb("y")).toBe(false);
    expect(dispatchGlobalVerb("z")).toBe(false);
  });

  it("no component under stages/world/ calls registerGlobalVerb directly except this module", () => {
    const rootDir = join(__dirname, ".."); // src/stages/world
    const pattern = /registerGlobalVerb\s*\(/;
    const allowed = "turn/worldVerbs.ts";
    const violations: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules") continue;
        const full = join(dir, entry);
        const stats = statSync(full);
        if (stats.isDirectory()) {
          walk(full);
          continue;
        }
        if (![".ts", ".tsx"].includes(extname(full))) continue;
        if (/\.(test|spec)\.[jt]sx?$/.test(entry)) continue;
        const relPath = relative(rootDir, full).split("\\").join("/");
        if (relPath === allowed) continue;
        const lines = readFileSync(full, "utf8").split(/\r?\n/);
        lines.forEach((line, i) => {
          if (pattern.test(line)) violations.push(`${relPath}:${i + 1}`);
        });
      }
    };
    walk(rootDir);

    expect(violations).toEqual([]);
  });
});
