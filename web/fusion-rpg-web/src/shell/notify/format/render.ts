import "./translators"; // side-effect import: the one place every domain translator registers
import { domainOf, type NotificationItem } from "../catalog";
import { defaultFormatKit } from "./kit";
import { translatorFor } from "./registry";
import type { NotifyText } from "./translator";

const warnedCategories = new Set<string>();

/** notify-format spec §4 Code style - the only entry point a surface calls. Surfaces never call a
 * translator directly. An unknown domain, or a translator returning `null` for this message key,
 * renders the designed fallback (categoryName + neutral body) - never the raw id or token
 * (`playbackTable.ts`'s own "never the raw token either way" discipline). */
export function renderNotification(item: NotificationItem): NotifyText {
  const domain = domainOf(item.category);
  const translator = domain ? translatorFor(domain) : undefined;
  const text = translator?.translate(item, defaultFormatKit) ?? null;
  if (text) return text;

  if (import.meta.env.DEV && !warnedCategories.has(item.category)) {
    warnedCategories.add(item.category);
    console.warn(
      `[notify/format] no translator rendered category "${item.category}" (domain "${domain ?? "unknown"}", key "${item.messageKey}") - falling back`
    );
  }
  return { title: defaultFormatKit.categoryName(item.category), body: "" };
}

/** Test isolation - not for production. */
export function resetRenderWarningsForTests(): void {
  warnedCategories.clear();
}
