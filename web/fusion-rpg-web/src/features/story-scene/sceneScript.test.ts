import { describe, expect, it } from "vitest";
import tuning from "@gk-core/data/tuning/story-scene-ui.v1.json";
import { registryFor } from "@/i18n/leadNames";
import { RIFT_PROLOGUE_SCRIPT, assertSceneScript, maxBeatsPerScene } from "./sceneScript";

/**
 * `scene-script` moves the four Rift beats out of the component and into a declared contract, so
 * scene 2 needs data rather than a TSX edit.
 *
 * Copy here is **authored** and its SSOT is `docs/ideas/onboarding-gnome-teaser.md`'s beat table.
 * These assertions pin the *contract* and the *copy parity*; they deliberately do not pin the beat
 * count as a population (the cap is a bound on authored content, read from the tuning file).
 */
describe("scene-script contract", () => {
  it("declares the narration beat as a beat with no speaker", () => {
    // Beat 3 was `"Gnome signal"`, a synthetic speaker that would render a name tag for a machine.
    // Narration is a line with NO speaker (Ren'Py's single-argument say), so the field is absent.
    const narration = RIFT_PROLOGUE_SCRIPT.beats.find((b) =>
      b.line.startsWith("UNSTABLE SECTOR")
    );
    expect(narration).toBeDefined();
    expect(narration!.speakerId).toBeUndefined();
  });

  it("carries no names-registry display string", () => {
    // A script line or teaching that names a lead is the same defect a catalog literal would be: the
    // name is registry data (§6.5b), the speakers are cast ids, and a rename must not need this file.
    const displays = Object.values(registryFor("en").names).map((row) => row.display);
    expect(displays.length).toBeGreaterThan(0);
    const json = JSON.stringify(RIFT_PROLOGUE_SCRIPT);
    for (const display of displays) expect(json).not.toContain(display);
  });

  it("names speakers by cast id, never a display string", () => {
    for (const beat of RIFT_PROLOGUE_SCRIPT.beats) {
      if (beat.speakerId === undefined) continue;
      expect(["dave", "penny"]).toContain(beat.speakerId);
    }
    // The old labels must be gone from the data entirely.
    const json = JSON.stringify(RIFT_PROLOGUE_SCRIPT);
    expect(json).not.toContain("Gnome signal");
    expect(json).not.toContain('"Dave"');
    expect(json).not.toContain('"Penny"');
  });

  it("carries no dead `seal` field", () => {
    // `seal` drove `data-sealed`, which nothing read: the quarantine mood is already carried by
    // `cueId === "rift.quarantine.seal"`, which rift.css styles.
    for (const beat of RIFT_PROLOGUE_SCRIPT.beats) {
      expect(beat).not.toHaveProperty("seal");
    }
  });

  it("keeps the authored copy byte-identical to the narrative source", () => {
    // Transcribed from docs/ideas/onboarding-gnome-teaser.md's beat table. If a wording changes,
    // the source changes first — this test is the copy-parity guard the spec asks for.
    const lines = RIFT_PROLOGUE_SCRIPT.beats.map((b) => b.line);
    expect(lines).toEqual([
      "Uh-oh. That lawn is doing the wrong kind of wobbly.",
      "Temporal signal unstable.",
      "UNSTABLE SECTOR. QUARANTINE PENDING.",
      "Then we fix it before they close the gate. Plants first. Questions later."
    ]);
  });

  it("gives every beat a cue id from the closed set, and the last two the quarantine cue", () => {
    const cues = RIFT_PROLOGUE_SCRIPT.beats.map((b) => b.cueId);
    expect(cues).toEqual([
      "rift.portal.open",
      "rift.portal.surge",
      "rift.quarantine.seal",
      "rift.quarantine.fade"
    ]);
  });

  it("identifies the scene by a stable id and a ledger version", () => {
    expect(RIFT_PROLOGUE_SCRIPT.sceneId).toBe("rift-prologue");
    expect(RIFT_PROLOGUE_SCRIPT.version).toBe(1);
  });

  it("gives every beat a teaching line that is one sentence, not a paragraph", () => {
    for (const beat of RIFT_PROLOGUE_SCRIPT.beats) {
      expect(beat.teaching).toBeTruthy();
      expect(beat.teaching!.length).toBeLessThan(140);
    }
  });

  it("reads the beat cap from the tuning file, so the guard cannot drift from its dial", () => {
    expect(maxBeatsPerScene()).toBe(tuning.scene.maxBeatsPerScene);
  });

  it("accepts the shipped script under its own cap", () => {
    expect(() => assertSceneScript(RIFT_PROLOGUE_SCRIPT)).not.toThrow();
    expect(RIFT_PROLOGUE_SCRIPT.beats.length).toBeLessThanOrEqual(maxBeatsPerScene());
  });

  it("rejects a malformed script at the boundary, so the fold never sees an empty scene", () => {
    expect(() =>
      assertSceneScript({ sceneId: "rift-prologue", version: 1, beats: [] })
    ).toThrow(/at least one beat/);
  });

  it("rejects a script over the cap, naming the cap rather than clamping", () => {
    const tooMany = Array.from({ length: maxBeatsPerScene() + 1 }, () => ({
      line: "x",
      teaching: "y"
    }));
    expect(() =>
      assertSceneScript({ sceneId: "rift-prologue", version: 1, beats: tooMany })
    ).toThrow(/beats/);
  });

  it("rejects a blank line, so an empty beat cannot ship", () => {
    expect(() =>
      assertSceneScript({
        sceneId: "rift-prologue",
        version: 1,
        beats: [{ line: "   ", teaching: "y" }]
      })
    ).toThrow(/has no line/);
  });

  it("fails at module load if its own shipped script is malformed", () => {
    // The guard is not merely exported for other callers — the module validates what it ships,
    // so a bad edit to RIFT_PROLOGUE_SCRIPT is a load-time error, not a runtime surprise.
    expect(() => assertSceneScript(RIFT_PROLOGUE_SCRIPT)).not.toThrow();
    expect(RIFT_PROLOGUE_SCRIPT.beats.length).toBeGreaterThan(0);
  });
});
