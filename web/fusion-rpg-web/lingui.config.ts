import type { LinguiConfig } from "@lingui/conf";

/**
 * T6: English first, plus a dev-only pseudolocale that renders `[!!…!!]`
 * around every translated string — the fastest way to catch a hardcoded
 * string or a layout that can't survive a longer translation. The
 * pseudolocale is stripped from the production build (see vite.config.ts).
 */
const config: LinguiConfig = {
  locales: ["en", "pseudo"],
  sourceLocale: "en",
  pseudoLocale: "pseudo",
  fallbackLocales: { pseudo: "en" },
  catalogs: [
    {
      path: "<rootDir>/src/i18n/locales/{locale}/messages",
      include: ["src"]
    }
  ]
};

export default config;
