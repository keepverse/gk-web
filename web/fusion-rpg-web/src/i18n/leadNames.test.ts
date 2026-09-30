import { describe, expect, it } from "vitest";
import namesEnJson from "@gk-data/data/seed/narrative/_registry/names.en.v1.json";
import {
  LEAD_TOKENS,
  leadName,
  leadNameValues,
  registryFor,
  type LeadNamesRegistry,
  type NameRow
} from "./leadNames";

const shipped = namesEnJson as unknown as LeadNamesRegistry;

/** The shipped rows with chosen displays replaced — a second name set, same tokens. */
function withDisplays(replacements: Record<string, string>, extra?: Record<string, NameRow>) {
  const names: Record<string, NameRow> = {};
  for (const [token, row] of Object.entries(shipped.names)) {
    names[token] = { ...row, display: replacements[token] ?? row.display };
  }
  if (extra) Object.assign(names, extra);
  return { ...shipped, names } as LeadNamesRegistry;
}

describe("leadName — the standalone label is the bare display", () => {
  it("resolves every lead token straight from the registry, with no article attached", () => {
    for (const token of LEAD_TOKENS) {
      const row = shipped.names[token];
      expect(leadName(token)).toBe(row.display);
      // The article is a tag, never part of the string (plan D2 / §6.5b).
      expect(leadName(token).toLowerCase().startsWith("the ")).toBe(false);
    }
  });

  it("throws on a token the registry has no row for, naming the token", () => {
    expect(() => leadName("lead_sidekick")).toThrow(/lead_sidekick/);
  });
});

describe("leadNameValues — the ICU values a message interpolates", () => {
  it("exposes each lead's display under its token and each tag under <token>_<tag>", () => {
    const values = leadNameValues();
    for (const token of LEAD_TOKENS) {
      const row = shipped.names[token];
      expect(values[token]).toBe(row.display);
      // The select-arm keys ARE the tag values, which is what lets the message own the article.
      expect(values[`${token}_article`]).toBe(row.article);
      expect(values[`${token}_gender`]).toBe(row.gender);
      expect(values[`${token}_number`]).toBe(row.number);
    }
  });

  it("falls back to English for the pseudo locale, matching lingui.config's fallbackLocales", () => {
    expect(registryFor("pseudo")).toBe(registryFor("en"));
    expect(registryFor("fr")).toBe(registryFor("en"));
    for (const token of LEAD_TOKENS) {
      expect(leadName(token, registryFor("pseudo"))).toBe(leadName(token));
    }
  });
});

describe("a second name set changes the output exactly at the tokens", () => {
  it("renames one lead and nothing else moves", () => {
    const renamed = withDisplays({ lead_summoner: "Examplar Vane" });
    const before = leadNameValues();
    const after = leadNameValues(renamed);

    expect(leadName("lead_summoner", renamed)).toBe("Examplar Vane");
    for (const token of LEAD_TOKENS) {
      const keys = [`${token}_article`, `${token}_gender`, `${token}_number`];
      for (const key of keys) expect(after[key]).toBe(before[key]);
      expect(after[token] === before[token]).toBe(token !== "lead_summoner");
    }
  });

  it("renames every lead and carries a character row the registry did not have", () => {
    const second = withDisplays(
      { lead_summoner: "Examplar Vane", lead_companion: "Lumen Reed", lead_antagonist: "Ashwright" },
      {
        c_examplar: {
          display: "Examplar Vane",
          article: "none",
          gender: "neuter",
          number: "singular",
          ruling: "none"
        }
      }
    );

    for (const token of LEAD_TOKENS) {
      expect(leadName(token, second)).toBe(second.names[token].display);
      expect(leadName(token, second)).not.toBe(leadName(token));
    }

    const values = leadNameValues(second);
    // A character row contributes the same two shapes, which is how the union reaches the catalog.
    expect(values.c_examplar).toBe("Examplar Vane");
    expect(values.c_examplar_article).toBe("none");
  });

  it("refuses a tag outside its closed set rather than emitting a value no select arm matches", () => {
    const broken = withDisplays({}, {
      lead_summoner: { ...shipped.names.lead_summoner, article: "indefinite" as never }
    });
    expect(() => leadNameValues(broken)).toThrow(/indefinite/);
  });
});

describe("the lead-token vocabulary is closed", () => {
  it("pins the three tokens of §6.5b", () => {
    // Pinned literally, with its reason: a fourth lead is a token-grammar change in narrative-seed,
    // so it has to fail this test first.
    expect(LEAD_TOKENS).toEqual(["lead_summoner", "lead_companion", "lead_antagonist"]);
  });
});
