import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { compilePseudoMessage, setLocale } from "@/i18n";
import { messages as enMessages } from "@/i18n/locales/en/messages.po";
import { renderWithProviders } from "@/test/render";
import { StorySceneHost } from "./StorySceneHost";
import { RIFT_PROLOGUE_SCRIPT } from "@/features/story-scene/sceneScript";
import { actorDefinition } from "@/features/story-scene/actorCast";
import { STORY_SCENE_CHROME, beatMessageId, storySceneMessages } from "@/features/story-scene/messages";

/**
 * Checkpoint F — "Pseudo locale renders no English from window / name tag / progress / controls".
 *
 * This is the program's own acceptance test for owner decision S4 ("i18n throughout, English
 * default; the pseudo-locale render is the acceptance test"), and it is the half its two sibling
 * suites could not cover: `src/i18n/index.test.ts` proves the catalog pseudo-wraps (including the
 * interpolated progress label) and `src/features/story-scene/messages.test.ts` proves the beat
 * descriptors match the script — but neither renders the assembled surface. A piece handed a raw
 * script string, or a host label resolved outside the catalog, leaves both green while the player
 * reads English under the pseudo locale.
 *
 * Assertions are by construction, never pinned copy: the expected text is computed at test time from
 * the same compiled catalog the app loads (`compilePseudoMessage`), so a copy edit that keeps the
 * message a message cannot red this suite. What reds it is a string that stopped being one — which
 * is exactly what the first version of this test found: the beats' lines, teachings and actor names
 * rendered English under the pseudo locale because the catalog was extracted and read by nobody.
 */

const mutateAsync = vi.fn();

vi.mock("@/lib/bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus")>();
  return { ...actual, useAcknowledgeOnboardingStory: () => ({ mutateAsync, isPending: false }) };
});

/** What the player should read for this message under the pseudo locale, derived, not pinned. */
function pseudoTextOf(id: string): string {
  const compiled = enMessages[id];
  if (compiled === undefined) throw new Error(`no catalog entry: ${id}`);
  const wrapped = compilePseudoMessage(compiled) as unknown[];
  return wrapped.filter((segment) => typeof segment === "string").join("");
}

/** The same, with the message's placeholders resolved — the shape an interpolated label renders. */
function pseudoInterpolated(id: string, values: Record<string, string | number>): string {
  const compiled = compilePseudoMessage(enMessages[id]) as unknown[];
  return compiled
    .map((segment) =>
      Array.isArray(segment) ? String(values[String(segment[0])] ?? "") : String(segment)
    )
    .join("");
}

/** Every `aria-label` currently in the document. */
function ariaLabels(): string[] {
  return Array.from(document.querySelectorAll("[aria-label]")).map(
    (el) => el.getAttribute("aria-label") ?? ""
  );
}

/** The English source of a message, for the "nothing renders verbatim" sweep. */
function englishOf(id: string): string {
  const compiled = enMessages[id];
  if (!Array.isArray(compiled)) return "";
  return compiled.filter((segment) => typeof segment === "string").join("");
}

function textOf(selector: string): string {
  const el = document.querySelector(selector);
  if (el == null) throw new Error(`missing element: ${selector}`);
  return (el.textContent ?? "").trim();
}

function renderScene() {
  renderWithProviders(
    <StorySceneHost script={RIFT_PROLOGUE_SCRIPT} open playerId={1} onClose={() => {}} />
  );
}

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({ ok: true });
  // The i18n instance is the app's own singleton; `afterEach` restores it so the English suites
  // that render this host are unaffected.
  setLocale("pseudo");
});

afterEach(() => {
  setLocale("en");
});

describe("story scene under the pseudo locale", () => {
  it("renders every beat's own catalog text for the line, teaching, name tag, progress and controls", async () => {
    const user = userEvent.setup();
    renderScene();

    const total = RIFT_PROLOGUE_SCRIPT.beats.length;
    for (let beat = 0; beat < total; beat += 1) {
      const scriptBeat = RIFT_PROLOGUE_SCRIPT.beats[beat];
      const position = beat + 1;

      // The beat actually advanced, and the progress label kept its interpolation (the defect T9
      // fixed was an interpolated message passing through pseudo unmarked).
      expect(ariaLabels(), `progress label for beat ${position}`).toContain(
        pseudoInterpolated("scene.rift-prologue.progress", { position, total })
      );

      // Content: this beat's own line and teaching, from the catalog, not from the script literal.
      expect(textOf(".story-dialogue-window__line"), `beat ${position} line`).toBe(
        pseudoTextOf(beatMessageId(RIFT_PROLOGUE_SCRIPT.sceneId, beat, "line"))
      );

      // A teaching sentence is present exactly where the script has one; where it is, it is the
      // catalog's text.
      const hasTeaching =
        scriptBeat.teaching !== undefined &&
        document.querySelector(".story-dialogue-window__teaching") !== null;
      if (hasTeaching) {
        expect(textOf(".story-dialogue-window__teaching"), `beat ${position} teaching`).toBe(
          pseudoTextOf(beatMessageId(RIFT_PROLOGUE_SCRIPT.sceneId, beat, "teaching"))
        );
      }

      // Name tag: present on spoken beats, absent on narration (beat 3). The name is registry DATA
      // (plan D2 / §6.5b), not a catalog msgstr: `registryFor` falls back to English for any locale
      // without its own names file, so under the pseudo locale the tag reads the registry's display
      // rather than a pseudo-wrapped string. What must never appear is an actor identifier leaked as
      // a name (`dave`/`penny`, or the pre-token `Dave`/`Penny`), which is what this sweep is for.
      if (scriptBeat.speakerId === undefined) {
        expect(
          document.querySelector(".story-dialogue-window__nameTag"),
          `beat ${position} is narration`
        ).toBeNull();
      } else {
        expect(textOf(".story-dialogue-window__nameTag"), `beat ${position} speaker`).toBe(
          actorDefinition(scriptBeat.speakerId).displayName
        );
        const leakedNameIds = ["Dave", "Penny", "dave", "penny"];
        const leakedNames = Array.from(document.querySelectorAll("*"))
          .filter((el) => el.children.length === 0)
          .map((el) => (el.textContent ?? "").trim())
          .filter((text) => leakedNameIds.includes(text));
        expect(leakedNames, `beat ${position} leaked actor identifier`).toEqual([]);
      }

      // Both verbs are catalog-resolved on every beat, last one included: skip is the ghost verb,
      // the primary is Next until the last beat and the final label on it.      expect(document.body.textContent).toContain(pseudoTextOf(STORY_SCENE_CHROME.skip.id));
      const controls = Array.from(document.querySelectorAll(".story-advance-control button"));
      expect(controls.length, `beat ${position} control count`).toBeGreaterThanOrEqual(2);
      for (const button of controls) {
        expect(button.textContent?.trim() ?? "", `beat ${position} control label`).toMatch(
          /^\[!![\s\S]*!!\]$/
        );
      }
      const expectedPrimary = pseudoTextOf(
        (position === total ? STORY_SCENE_CHROME.final : STORY_SCENE_CHROME.next).id
      );
      expect(
        controls.map((button) => button.textContent?.trim()),
        `beat ${position} primary label`
      ).toContain(expectedPrimary);

      // The sprite placeholder's chrome is host-resolved too (F9: the hint and the accessible label
      // were English literals no locale could change). Asserted on every beat because both actors
      // render their placeholder at once, and the label interpolates each actor's resolved name.
      const hints = Array.from(document.querySelectorAll(".story-actor-sprite__hint")).map((el) =>
        (el.textContent ?? "").trim()
      );
      expect(hints.length, `beat ${position} sprite hints`).toBeGreaterThan(0);
      for (const hint of hints) {
        expect(hint, `beat ${position} sprite hint`).toBe(
          pseudoTextOf("story-scene.sprite.hint")
        );
      }
      const spriteLabels = Array.from(
        document.querySelectorAll(".story-actor-sprite__placeholder")
      ).map((el) => (el.getAttribute("aria-label") ?? "").trim());
      const expectedLabels = (["penny", "dave"] as const).map((actorId) =>
        pseudoInterpolated("story-scene.sprite.placeholder", {
          // The interpolated value is the registry's display (plan D2 / §6.5b): a name is data and
          // is not pseudo-wrapped, only the catalog chrome around it is.
          name: actorDefinition(actorId).displayName
        })
      );
      expect(spriteLabels.slice().sort(), `beat ${position} sprite labels`).toEqual(
        expectedLabels.slice().sort()
      );

      // …and the initial is deliberately NOT localized: it is the fallback's identity glyph
      // (`spec-actor-cast.md` § "initial is not localized"), so it stays the authored letter even
      // while the name beside it is marked. Pinned here so the decision cannot change by accident.
      const initials = Array.from(document.querySelectorAll(".story-actor-sprite__initial"))
        .map((el) => (el.textContent ?? "").trim())
        .sort();
      expect(initials, `beat ${position} fallback initials`).toEqual(
        (["penny", "dave"] as const)
          .map((actorId) => actorDefinition(actorId).initial)
          .sort()
      );
      for (const initial of initials) {
        expect(initial, "an initial must not be pseudo-marked").not.toContain("[!!");
      }

      if (position < total) {
        await user.click(screen.getByRole("button", { name: expectedPrimary }));
      }
    }
  });

  it("follows a locale switch made while the scene is open", () => {
    // The scene resolves chrome AND content through the active locale, and the app can change that
    // locale under it (System → Preferences, `SystemLayer.tsx:117-118`). Keying the resolvers on the
    // `i18n` singleton alone left everything in the mount-time language — the singleton's identity
    // never changes — so this test is the one that notices.
    setLocale("en");
    renderScene();
    expect(textOf(".story-dialogue-window__line")).toBe(
      englishOf(beatMessageId(RIFT_PROLOGUE_SCRIPT.sceneId, 0, "line"))
    );

    act(() => setLocale("pseudo"));

    expect(textOf(".story-dialogue-window__line")).toBe(
      pseudoTextOf(beatMessageId(RIFT_PROLOGUE_SCRIPT.sceneId, 0, "line"))
    );
    expect(textOf(".story-dialogue-window__nameTag")).toBe(
      actorDefinition("dave").displayName
    );
    expect(document.querySelector('[aria-label^="[!!Beat "]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /^\[!!Skip intro!!\]$/ })).toBeInTheDocument();
  });

  it("renders no story-scene message's English source verbatim, on any element", () => {
    renderScene();

    // Leaf elements only: a container's textContent concatenates its children, so a wrapper would
    // never equal one message's source and the sweep would silently pass.
    const leafText = new Set(
      Array.from(document.querySelectorAll("*"))
        .filter((el) => el.children.length === 0)
        .map((el) => (el.textContent ?? "").trim())
        .filter((text) => text.length > 0)
    );

    const offenders = Object.keys(storySceneMessages()).filter((id) => {
      const english = englishOf(id);
      return english.length > 0 && leafText.has(english);
    });

    expect(
      offenders,
      `unlocalized English under the pseudo locale: ${offenders.join(", ")}`
    ).toEqual([]);
  });
});
