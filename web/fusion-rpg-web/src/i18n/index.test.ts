import { afterEach, describe, expect, it } from "vitest";
import { messages as enMessages } from "./locales/en/messages.po";
import { compilePseudoMessage, i18n, setLocale } from "./index";

const firstMessageId = Object.keys(enMessages)[0]!;

/** Renders a pseudo message with no interpolation args, for the shape-comparison assertions. */
function pseudoOf(id: string): string {
  const compiled = enMessages[id];
  const wrapped = compilePseudoMessage(compiled) as unknown[];
  // The text segments are now marked; reconstruct what a caller with no args would see.
  return wrapped.filter((s) => typeof s === "string").join("");
}

describe("i18n locale switching", () => {
  afterEach(() => {
    setLocale("en");
  });

  it("defaults to en with the real source text", () => {
    expect(i18n.locale).toBe("en");
    expect(i18n._(firstMessageId)).toBe((enMessages[firstMessageId] as [string])[0]);
  });

  it("pseudo marks every literal run in a simple message", () => {
    setLocale("pseudo");
    expect(i18n.locale).toBe("pseudo");
    for (const [id, compiled] of Object.entries(enMessages)) {
      const segments = compilePseudoMessage(compiled) as unknown[];
      const hasPlaceholder = segments.some((s) => Array.isArray(s));
      if (hasPlaceholder) continue; // covered by the interpolated test below
      const source = (compiled as [string])[0];
      expect(i18n._(id)).toBe(`[!!${source}!!]`);
    }
  });

  /**
   * Interpolated messages must be pseudolocalized too.
   *
   * The original implementation passed any message richer than `[text]` through **untouched**, so
   * an ICU message rendered plain English under the pseudo locale — invisible, because every message
   * in the catalog happened to be simple until the story scene added `"Beat {position} of {total}"`.
   * That is the exact hardcoded-English symptom the pseudo locale exists to catch, so it is fixed
   * here rather than worked around by making the story label simple.
   */
  it("pseudo marks the literal runs of an interpolated message while keeping placeholders", () => {
    const compiled = enMessages["scene.rift-prologue.progress"];
    expect(Array.isArray(compiled)).toBe(true);
    const wrapped = compilePseudoMessage(compiled) as unknown[];

    // Placeholders survive so interpolation still resolves.
    expect(wrapped.filter((s) => Array.isArray(s))).toEqual([["position"], ["total"]]);
    // Every literal run is marked.
    expect(pseudoOf("scene.rift-prologue.progress")).toBe("[!!Beat !!][!! of !!]");

    setLocale("pseudo");
    expect(i18n._("scene.rift-prologue.progress", { position: 2, total: 4 })).toBe(
      "[!!Beat !!]2[!! of !!]4"
    );
  });

  it("leaves a shape it does not handle untouched rather than guessing", () => {
    // A plural/select compiled form nests objects; passing it through unmarked is the honest
    // behaviour, and this pins that the guard is deliberate rather than accidental.
    const pluralish = ["{count, plural, one {# item} other {# items}}"];
    expect(compilePseudoMessage(pluralish)).toEqual([
      "[!!{count, plural, one {# item} other {# items}}!!]"
    ]);
    expect(compilePseudoMessage({ nested: true })).toEqual({ nested: true });
    expect(compilePseudoMessage([{ plural: "obj" }])).toEqual([{ plural: "obj" }]);
  });

  it("switching back to en restores the plain source text", () => {
    setLocale("pseudo");
    setLocale("en");
    expect(i18n._(firstMessageId)).toBe((enMessages[firstMessageId] as [string])[0]);
  });

  // The "never outside dev" half of setLocale("pseudo")'s guard can't be
  // unit-tested here — Vitest always runs with import.meta.env.DEV === true,
  // and that flag is a Vite compile-time constant, not a runtime value this
  // module can be made to see differently. It's verified instead by
  // inspecting the production build output for the [!! marker (see the
  // task's manual verification step) — a real grep on real dead-code
  // elimination, not a mock of a compile-time constant.
});
