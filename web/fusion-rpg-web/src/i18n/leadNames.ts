import namesEnJson from "@gk-data/data/seed/narrative/_registry/names.en.v1.json";

/**
 * The web reader for the lead names registry
 * (`gk-data/packs/fusion/data/seed/narrative/_registry/names.en.v1.json`), the file the C# side reads through
 * `FusionRpg.Core.Narrative.LeadNames` and the server configures at boot.
 *
 * The story grammar names an entity by **token** — `{lead_summoner}`, `{lead_companion}`,
 * `{lead_antagonist}` — never by a display string
 * (`docs/architecture/narrative-seed-ideal.md` §6.5b). This module is the only place the web turns a
 * token into words, so renaming a lead is one row edit in the registry and nothing else.
 *
 * **Two shapes, because a name has two jobs (plan D2).**
 *   * `leadName(token)` is the bare display — the standalone label: a story name tag, a list row, a
 *     faction label. It never carries an article.
 *   * `leadNameValues()` is the ICU *values* object a message interpolates. It carries the bare
 *     display under the token, and the row's closed feature tags under `<token>_article`,
 *     `<token>_gender` and `<token>_number` — the keys a `select` matches on, so the **message** owns
 *     the article:
 *
 *       `"{lead_summoner_article, select, definite {The } other {}}{lead_summoner} joins your side."`
 *
 *     That is what makes "The Garden Keeper joins your side" and the vocative "You are too late,
 *     Keeper" come out of one row, with no string surgery here.
 *
 * The English catalog is the only registry that ships today. `lang`, like the pseudolocale, reads it:
 * `lingui.config.ts` declares `fallbackLocales: { pseudo: "en" }`, and this reader makes the same
 * choice for any locale without a file of its own, so a pseudolocale render never shows a literal
 * token. A second locale is additive — its `names.<locale>.v1.json` beside the English one, plus its
 * entry in `registries` below.
 */

/** The closed `article` tag: whether a name reads with "the". */
export const NAME_ARTICLES = ["definite", "none"] as const;
/** The closed `gender` tag: what pronouns and verb agreement a name takes. */
export const NAME_GENDERS = ["male", "female", "neuter", "none"] as const;
/** The closed `number` tag. `plural` is reserved for group tokens. */
export const NAME_NUMBERS = ["singular", "plural", "none"] as const;

export type NameArticle = (typeof NAME_ARTICLES)[number];
export type NameGender = (typeof NAME_GENDERS)[number];
export type NameNumber = (typeof NAME_NUMBERS)[number];

/**
 * The three lead tokens, as a closed vocabulary (§6.5b). A fourth lead is a token-grammar change
 * (narrative-seed module 8), so this list is pinned by test rather than derived from the registry.
 */
export const LEAD_TOKENS = ["lead_summoner", "lead_companion", "lead_antagonist"] as const;

export type LeadToken = (typeof LEAD_TOKENS)[number];

export interface NameRow {
  readonly display: string;
  readonly article: NameArticle;
  readonly gender: NameGender;
  readonly number: NameNumber;
  readonly ruling: string;
}

export interface LeadNamesRegistry {
  readonly schemaVersion: number;
  readonly registryVersion?: number;
  readonly locale: string;
  readonly names: Readonly<Record<string, NameRow>>;
}

const registries: Record<string, LeadNamesRegistry> = {
  en: namesEnJson as unknown as LeadNamesRegistry
};

/**
 * The registry for a locale. A locale with no file of its own reads English — the same fallback
 * `lingui.config.ts` declares for `pseudo`.
 */
export function registryFor(locale: string): LeadNamesRegistry {
  return registries[locale] ?? registries.en;
}

/** The bare display string for a token: the standalone-label shape. An unknown token throws — a
 * silently blank or defaulted name would ship a wrong identity into player-facing copy. */
export function leadName(token: string, registry: LeadNamesRegistry = registryFor("en")): string {
  const row = registry.names[token];
  if (!row) throw new Error(`lead names: the registry has no row for token '${token}'`);
  return row.display;
}

/**
 * The ICU values object for one registry: each token's bare display, plus its three feature tags under
 * `<token>_<tag>`. Feed it to `i18n._(msg, values)` and the message's `select` arms resolve.
 */
export function leadNameValues(registry: LeadNamesRegistry = registryFor("en")): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [token, row] of Object.entries(registry.names)) {
    assertTag(NAME_ARTICLES, row.article, token, "article");
    assertTag(NAME_GENDERS, row.gender, token, "gender");
    assertTag(NAME_NUMBERS, row.number, token, "number");

    values[token] = row.display;
    values[`${token}_article`] = row.article;
    values[`${token}_gender`] = row.gender;
    values[`${token}_number`] = row.number;
  }
  return values;
}

/**
 * A tag outside its closed set would emit a value no `select` arm matches, and ICU would quietly take
 * the `other` arm — a visible grammar defect with no error anywhere. Refused here instead. The C#
 * parser refuses the same values, so the registry and both readers move together.
 */
function assertTag(allowed: readonly string[], value: string, token: string, tag: string): void {
  if (!allowed.includes(value)) {
    throw new Error(
      `lead names: row '${token}' has unknown ${tag} '${value}' (${allowed.join(" | ")})`
    );
  }
}
