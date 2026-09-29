import { describe, expect, it } from "vitest";
import {
  RIFT_PROLOGUE_TRIGGER,
  type StoryLedgerEntry,
  isSceneEligible
} from "./sceneTrigger";

/**
 * `scene-trigger` names the seam that answers one question — "should this scene play for this player
 * right now?" — so scene 2 has a home for its trigger without this program becoming a story engine.
 *
 * The governing rule: **the server is the authority.** `eligible` comes from the story ledger the
 * backend already owns; the FE's optional `when` predicate can only ever **narrow** it. That rule is
 * the first two tests below, because getting it backwards would let the FE show a story the server
 * has decided is not due — the exact class of bug a client-side rule engine produces.
 */
const row = (over: Partial<StoryLedgerEntry> = {}): StoryLedgerEntry => ({
  storyId: "rift-prologue",
  version: 1,
  state: "pending",
  eligible: true,
  ...over
});

const NO_LAYERS = { noLayerOpen: true };

describe("isSceneEligible", () => {
  it("plays a scene the server reports eligible, when no layer is open", () => {
    expect(isSceneEligible(RIFT_PROLOGUE_TRIGGER, [row()], NO_LAYERS)).toBe(true);
  });

  it("never plays a scene the server reports ineligible — `when` cannot widen it", () => {
    // A `when` that always says yes must not override the server. This is the load-bearing rule.
    const alwaysYes = { ...RIFT_PROLOGUE_TRIGGER, when: () => true };
    expect(isSceneEligible(alwaysYes, [row({ eligible: false })], NO_LAYERS)).toBe(false);
  });

  it("lets `when` narrow an eligible scene", () => {
    const narrowed = { ...RIFT_PROLOGUE_TRIGGER, when: () => false };
    expect(isSceneEligible(narrowed, [row({ eligible: true })], NO_LAYERS)).toBe(false);
  });

  it("never opens over an open layer, even when eligible", () => {
    // A scene appearing on top of a panel is the interrupting-dialog failure mode; the stage
    // already checked `openLayer === null` inline, and this makes it a first-class precondition.
    expect(isSceneEligible(RIFT_PROLOGUE_TRIGGER, [row()], { noLayerOpen: false })).toBe(false);
  });

  it("does not match a different version — a bumped script re-presents", () => {
    // Version-pinned on purpose: matching only the id would let a v1 acknowledgement silence a v2
    // script that has new beats.
    expect(isSceneEligible(RIFT_PROLOGUE_TRIGGER, [row({ version: 2 })], NO_LAYERS)).toBe(false);
  });

  it("does not match a different scene", () => {
    expect(isSceneEligible(RIFT_PROLOGUE_TRIGGER, [row({ storyId: "other-story" })], NO_LAYERS)).toBe(
      false
    );
  });

  it("returns false when the player has no ledger row at all", () => {
    expect(isSceneEligible(RIFT_PROLOGUE_TRIGGER, [], NO_LAYERS)).toBe(false);
  });

  it("is pure — repeated calls with the same input agree, and the ledger is not mutated", () => {
    const ledger = [row()];
    const snapshot = JSON.stringify(ledger);
    expect(isSceneEligible(RIFT_PROLOGUE_TRIGGER, ledger, NO_LAYERS)).toBe(true);
    expect(isSceneEligible(RIFT_PROLOGUE_TRIGGER, ledger, NO_LAYERS)).toBe(true);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });

  it("ignores a row whose state is acknowledged but which the server still calls eligible", () => {
    // `eligible` is the server's decision, not a function of `state` the FE re-derives. If the two
    // ever disagree, the server wins — this documents that the FE does not second-guess it.
    expect(isSceneEligible(RIFT_PROLOGUE_TRIGGER, [row({ state: "acknowledged" })], NO_LAYERS)).toBe(
      true
    );
    expect(isSceneEligible(RIFT_PROLOGUE_TRIGGER, [row({ state: "pending" })], NO_LAYERS)).toBe(true);
  });

  it("pins the prologue trigger to the ledger contract's identity", () => {
    // Must stay in step with `storyContract.ts` and the ack the host sends, or a story plays
    // against a version the ledger does not have.
    expect(RIFT_PROLOGUE_TRIGGER.sceneId).toBe("rift-prologue");
    expect(RIFT_PROLOGUE_TRIGGER.version).toBe(1);
  });

  it("declares no copy and no scheduling — it is identity plus an optional predicate only", () => {
    expect(Object.keys(RIFT_PROLOGUE_TRIGGER).sort()).toEqual(["sceneId", "version"]);
  });
});
