import { i18n, type Messages } from "@lingui/core";
import { messages as enMessages } from "./locales/en/messages.po";

/**
 * English-first (web/spec.md §10 — a second locale is enabled by this work,
 * not delivered by it). The dev-only pseudolocale wraps every translated
 * string in `[!! … !!]` so a hardcoded string or a layout that can't survive
 * a longer translation is visible immediately, without a translator in the
 * loop.
 *
 * `src/i18n/locales/pseudo/messages.po` is `lingui extract`'s own scratch
 * catalog (kept so its reference/line tracking works) but is not read here —
 * pseudo strings are derived programmatically from the compiled `en`
 * catalog instead of hand-maintained, so they can never drift out of sync
 * with it. `import.meta.env.DEV` is a Vite compile-time constant; the branch
 * that builds the pseudo catalog is dead code in a production build and
 * does not ship (verified by grep on the built bundle).
 */
export type SupportedLocale = "en" | "pseudo";

const PSEUDO_PREFIX = "[!!";
const PSEUDO_SUFFIX = "!!]";

/**
 * Wrap a compiled message's **text segments** in the pseudo markers, leaving its placeholder
 * segments untouched.
 *
 * A compiled message is a flat array alternating literal text and placeholder tuples:
 *   simple      → `["Next"]`
 *   interpolated → `["Beat ", ["position"], " of ", ["total"]]`
 *
 * The earlier implementation wrapped only the simple shape and **passed interpolated messages
 * through unchanged**, so any message using ICU interpolation escaped pseudolocalization entirely —
 * it would render plain English under the pseudo locale, which is precisely the hardcoded-English
 * symptom the pseudo locale exists to expose. The story scene's beat-position label
 * (`"Beat {position} of {total}"`) is the first interpolated message in the catalog, and it surfaced
 * the gap.
 *
 * Wrapping only the string segments keeps the placeholders intact, so interpolation still resolves;
 * the markers land around each literal run rather than spanning the whole message (the same
 * per-segment treatment `@lingui`'s own pseudolocale uses). A richer shape than this flat
 * alternation — a plural/select compiled form — is still passed through untouched rather than
 * guessed at, and the accompanying test asserts the shapes this function does handle.
 */
export function compilePseudoMessage(compiled: unknown): unknown {
  if (typeof compiled === "string") {
    return `${PSEUDO_PREFIX}${compiled}${PSEUDO_SUFFIX}`;
  }
  if (!Array.isArray(compiled)) return compiled;

  // Only the flat alternation of literal text and placeholder tuples is handled here. A compiled
  // plural/select nests objects, which is a different shape this deliberately does not guess at.
  const isFlatAlternation = compiled.every(
    (segment) => typeof segment === "string" || Array.isArray(segment)
  );
  const hasTextSegment = compiled.some((segment) => typeof segment === "string");
  if (!isFlatAlternation || !hasTextSegment) return compiled;

  return compiled.map((segment) =>
    typeof segment === "string" && segment.length > 0
      ? `${PSEUDO_PREFIX}${segment}${PSEUDO_SUFFIX}`
      : segment
  );
}

function toPseudoMessages(source: Messages): Messages {
  const pseudo: Messages = {};
  for (const [id, compiled] of Object.entries(source)) {
    pseudo[id] = compilePseudoMessage(compiled) as Messages[string];
  }
  return pseudo;
}

i18n.load("en", enMessages);
i18n.activate("en");

let pseudoLoaded = false;

export function setLocale(locale: SupportedLocale): void {
  if (locale === "pseudo") {
    if (!import.meta.env.DEV) return; // never activates outside dev
    if (!pseudoLoaded) {
      i18n.load("pseudo", toPseudoMessages(enMessages));
      pseudoLoaded = true;
    }
  }
  i18n.activate(locale);
}

export { i18n };

// Dev-only debug hook, stripped from production like the pseudolocale branch
// above (same import.meta.env.DEV mechanism). A locale toggle in the UI is
// System settings' job (T20); until then this is the one way to exercise
// `setLocale` against the app's real, running i18n instance instead of a
// fresh one — QA/live-verification convenience, not a shipped feature.
if (import.meta.env.DEV) {
  (window as unknown as { __i18nDebug?: { i18n: typeof i18n; setLocale: typeof setLocale } }).__i18nDebug = {
    i18n,
    setLocale
  };
}
