import type { NotifyTranslator } from "./translator";

const registry = new Map<string, NotifyTranslator>();

/** Domain translators live WITH their domain (e.g. `stages/world/notify/worldTranslator.ts`) and
 * register from one index, `translators.ts` - the only place shared code imports a domain module. */
export function registerTranslator(t: NotifyTranslator): void {
  registry.set(t.domain, t);
}

export function translatorFor(domain: string): NotifyTranslator | undefined {
  return registry.get(domain);
}

/** Test isolation - not for production. */
export function resetTranslatorRegistryForTests(): void {
  registry.clear();
}
