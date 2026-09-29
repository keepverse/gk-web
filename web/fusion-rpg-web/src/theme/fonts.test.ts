import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("fonts.css — offline promise (T7)", () => {
  it("never references a remote font host", () => {
    const css = readFileSync(join(__dirname, "fonts.css"), "utf8");
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  it("imports only local @fontsource packages", () => {
    const css = readFileSync(join(__dirname, "fonts.css"), "utf8");
    const imports = [...css.matchAll(/@import\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const imp of imports) {
      expect(imp.startsWith("@fontsource/")).toBe(true);
    }
  });
});
