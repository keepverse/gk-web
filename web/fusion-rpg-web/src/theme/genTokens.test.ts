import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generate, OUTPUT_PATH } from "../../scripts/gen-tokens.mjs";

describe("gen-tokens — drift check (T7)", () => {
  it("the committed src/theme/tokens.css matches what the generator produces from the kit", () => {
    const committed = readFileSync(OUTPUT_PATH, "utf8").replace(/\r\n/g, "\n");
    const generated = generate().replace(/\r\n/g, "\n");
    expect(committed).toBe(generated);
  });
});
