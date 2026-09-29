import { describe, expect, it } from "vitest";
import {
  entryKindLabel,
  extractionOutcomeLabel,
  nerveStageLabel,
  objectKindLabel,
  objectVerbLabel,
  partyBannerLabel,
  raidModeLabel,
  roomKindLabel,
  startRefusalMessage,
  wildVerbLabel
} from "./labels";

describe("partyBannerLabel — PartyIndex never rendered raw (spec-delve-stage.md §8 row 4; ask 13)", () => {
  it("maps 0..3 to the four fixed Banner names, in order", () => {
    expect(partyBannerLabel(0)).toBe("First Banner");
    expect(partyBannerLabel(1)).toBe("Second Banner");
    expect(partyBannerLabel(2)).toBe("Third Banner");
    expect(partyBannerLabel(3)).toBe("Fourth Banner");
  });

  it("an out-of-range index falls back to a name, never a bare ordinal — unlike graph/roomKindLabels.ts's own same-purpose fallback", () => {
    const result = partyBannerLabel(7);
    expect(result).toBe("Unnamed Banner");
    expect(/\d/.test(result)).toBe(false);
  });
});

describe("entryKindLabel — Entry_kind_renders_as_a_phrase_never_the_enum (spec-delve-stage.md §8 row 3)", () => {
  it("Entry_kind_renders_as_a_phrase_never_the_enum — 'single-descent' renders as its own phrase, never the wire id", () => {
    const result = entryKindLabel("single-descent");
    expect(result).toBe("One descent only");
    expect(result).not.toBe("single-descent");
  });

  it("Entry_kind_renders_as_a_phrase_never_the_enum — 'standing' renders as its own phrase, never the wire id", () => {
    const result = entryKindLabel("standing");
    expect(result).toBe("Open ground");
    expect(result).not.toBe("standing");
  });

  it("neither phrase leaks the engine words the wire value is adapted from ('once'/'many' never reach this function, but the rendered text must not echo them either)", () => {
    expect(entryKindLabel("single-descent")).not.toMatch(/\bonce\b|\bmany\b/i);
    expect(entryKindLabel("standing")).not.toMatch(/\bonce\b|\bmany\b/i);
  });
});

describe("raidModeLabel (spec-delve-stage.md §8 row 3; RaidModeCatalog's closed three)", () => {
  it("maps the three real raid-mode ids to their phrases", () => {
    expect(raidModeLabel("solo")).toBe("One band");
    expect(raidModeLabel("pair")).toBe("Two bands");
    expect(raidModeLabel("quad")).toBe("Four bands");
  });

  it("an unrecognised id falls back to the narrowest reading ('solo'), never the raw id", () => {
    const result = raidModeLabel("hex");
    expect(result).toBe("One band");
    expect(result).not.toBe("hex");
  });
});

describe("nerveStageLabel (spec-delve-stage.md §8 row 5; NervePolicy's own registry members)", () => {
  it("maps the three real nerveStage ids to their phrases, matching bands.v1.json's own wording", () => {
    expect(nerveStageLabel("unsettled")).toBe("Unsettled");
    expect(nerveStageLabel("shaken")).toBe("Shaken");
    expect(nerveStageLabel("afflicted")).toBe("Afflicted");
  });

  it("an unrecognised id falls back to the mildest real stage, never invents a worse one", () => {
    const result = nerveStageLabel("catatonic");
    expect(result).toBe("Unsettled");
    expect(result).not.toBe("catatonic");
  });
});

describe("roomKindLabel (spec-delve-stage.md §8 row 8; the eleven real room-kind ids)", () => {
  const ALL_ELEVEN: Record<string, string> = {
    fight: "Fight",
    elite: "Elite",
    cache: "Cache",
    curio: "Curio",
    wild: "A stranger",
    shrine: "Shrine",
    rest: "Camp",
    merchant: "Trader",
    trap: "Trap",
    unknown: "Unclear",
    boss: "The lair"
  };

  it("maps every one of the eleven real ids to §8's own literal phrase, in the spec's own order", () => {
    for (const [kind, phrase] of Object.entries(ALL_ELEVEN)) {
      expect(roomKindLabel(kind)).toBe(phrase);
    }
  });

  it("never echoes the raw wire id back as its own label (every one of the eleven genuinely translates)", () => {
    for (const kind of Object.keys(ALL_ELEVEN)) {
      expect(roomKindLabel(kind)).not.toBe(kind);
    }
  });

  it("a sight-gated room (kind: null) passes through as null, never a phrase guessed at", () => {
    expect(roomKindLabel(null)).toBeNull();
  });

  it("an unrecognised non-null id falls back to the 'unknown' kind's own phrase, never the raw id — unlike graph/roomKindLabels.ts's own same-purpose fallback", () => {
    const result = roomKindLabel("some-future-kind");
    expect(result).toBe("Unclear");
    expect(result).not.toBe("some-future-kind");
  });
});

describe("wildVerbLabel (D5.7, spec-delve-stage.md §7 — TalkView.offered's real WildVerb ids)", () => {
  const ALL_EIGHT: Record<string, string> = {
    Flatter: "Flatter",
    Threaten: "Threaten",
    OfferSouls: "Offer souls",
    OfferSpirit: "Offer spirit",
    OfferSupply: "Offer supplies",
    OfferContract: "Offer a contract",
    Fight: "Fight",
    Leave: "Leave"
  };

  it("maps every one of the eight real WildVerb ids to its own plain phrase", () => {
    for (const [verb, phrase] of Object.entries(ALL_EIGHT)) {
      expect(wildVerbLabel(verb)).toBe(phrase);
    }
  });

  it("an unrecognised verb id falls back to Leave's own phrase, never the raw id", () => {
    const result = wildVerbLabel("SomeFutureVerb");
    expect(result).toBe("Leave");
    expect(result).not.toBe("SomeFutureVerb");
  });
});

describe("objectVerbLabel (D5.7, spec-delve-stage.md §7 — ObjectPromptView.verbs' real six ids)", () => {
  const ALL_SIX: Record<string, string> = {
    open: "Open",
    disarm: "Disarm",
    pray: "Pray",
    loot: "Loot",
    destroy: "Destroy",
    garrison: "Garrison"
  };

  it("maps every one of the six real, lowercase verb ids to its own capitalized phrase", () => {
    for (const [verb, phrase] of Object.entries(ALL_SIX)) {
      expect(objectVerbLabel(verb)).toBe(phrase);
    }
  });

  it("an unrecognised verb id falls back to a deliberately vague, safe phrase, never a guess at what it does", () => {
    const result = objectVerbLabel("someFutureVerb");
    expect(result).toBe("Do something");
    expect(result).not.toBe("someFutureVerb");
  });
});

describe("extractionOutcomeLabel (D5.9, spec-delve-stage.md §8 row 6 — the real SettlementOutcome three, not the five-way prose)", () => {
  it("maps the three real SettlementOutcome ids to their phrases", () => {
    expect(extractionOutcomeLabel("Roster")).toBe("Unharmed");
    expect(extractionOutcomeLabel("Recover")).toBe("Recovering");
    expect(extractionOutcomeLabel("Retire")).toBe("Fallen");
  });

  it("never renders the banned word 'Retired' for the permanent-loss outcome — 'Fallen' only", () => {
    const result = extractionOutcomeLabel("Retire");
    expect(result).toBe("Fallen");
    expect(result).not.toMatch(/retired/i);
  });

  it("an unrecognised outcome falls back to Roster's own reading, never the raw id and never a guess at a worse one", () => {
    const result = extractionOutcomeLabel("SomeFutureOutcome");
    expect(result).toBe("Unharmed");
    expect(result).not.toBe("SomeFutureOutcome");
  });
});

describe("objectKindLabel (D5.7, spec-delve-stage.md §7 — ObjectPromptView.kind's real four ObjectKind ids)", () => {
  it("maps every one of the four real ObjectKind ids to its own plain noun", () => {
    expect(objectKindLabel("Curio")).toBe("Curio");
    expect(objectKindLabel("Obstacle")).toBe("Obstacle");
    expect(objectKindLabel("Building")).toBe("Building");
    expect(objectKindLabel("Structure")).toBe("Structure");
  });

  it("an unrecognised kind id falls back to Curio's own phrase, never the raw id", () => {
    const result = objectKindLabel("SomeFutureKind");
    expect(result).toBe("Curio");
    expect(result).not.toBe("SomeFutureKind");
  });
});

describe("startRefusalMessage (D5.8, spec-delve-stage.md §8 row 9 + §10's whole refusal table)", () => {
  it("maps every named refusal group to its own sentence, never the raw rule id", () => {
    const cases: Record<string, string> = {
      "domain.unknown": "That domain isn't open to you anymore.",
      "domain.stale": "That domain isn't open to you anymore.",
      "domain.not-found": "That domain isn't open to you anymore.",
      "domain.sealed": "This domain is closed to you.",
      "delve.in-progress": "A delve is already under way there.",
      "correlation.mismatch": "That request already went through — refreshing.",
      "rung.not-offered": "That choice isn't offered right now.",
      "raid.mode-not-offered": "That choice isn't offered right now.",
      "raid.party-shape": "That choice isn't offered right now.",
      "oath.implied": "This descent requires accepting the Oath.",
      "delve.souls-insufficient": "You don't have enough souls for this.",
      "delve.price-undesigned": "Not for sale here."
    };
    for (const [reason, message] of Object.entries(cases)) {
      expect(startRefusalMessage(reason)).toBe(message);
      expect(startRefusalMessage(reason)).not.toBe(reason);
    }
  });

  it("a templated member.unavailable:{id} refusal is recognised by prefix, and never leaks the raw id", () => {
    const result = startRefusalMessage("member.unavailable:actor-42");
    expect(result).toBe("One of the chosen creatures can't go on this delve right now.");
    expect(result).not.toContain("actor-42");
    expect(result).not.toContain("member.unavailable");
  });

  it("an unrecognised reason falls back to the frozen-terms group's own honest sentence, never a guess at a more specific cause", () => {
    const result = startRefusalMessage("some.future.rule");
    expect(result).toBe("The way did not open.");
    expect(result).not.toBe("some.future.rule");
  });
});
