import { describe, expect, it } from "vitest";
import catalogJson from "@gk-core/data/tuning/notification-catalog.v3.json";
import { translatorFor } from "./registry";
import { renderNotification } from "./render";
import "./translators"; // the one place every domain translator registers

interface CatalogCategoryJson {
  id: string;
  domain: string;
  displayName: string;
  messageKeys: string[];
}
const categories = catalogJson.categories as CatalogCategoryJson[];

/**
 * notify-format spec Testing 3 - loops over the LIVE catalog at test time, so this guard grows with
 * the open registry without a pinned number (validation-ssot, DESIGN-GATE §3 rule 7). Reads the
 * SAME file `Program.cs`/`catalog.ts` load (H7 - a coverage guard pointed at an orphaned version
 * would silently stop testing anything real the moment the readers moved on). world-notify-source
 * (NS5.4/NS5.6) is the first module to populate it; cache-notify-source (NS6.3/NS6.4) adds v3's
 * rows AND its translator's samples() in the same change.
 */
describe("coverage guard - every catalog (category, messageKey) renders without the fallback", () => {
  for (const category of categories) {
    for (const messageKey of category.messageKeys) {
      it(`${category.id} / ${messageKey} has a sample that renders through its own translator`, () => {
        const translator = translatorFor(category.domain);
        expect(translator, `no translator registered for domain "${category.domain}"`).toBeDefined();

        const samples = translator!.samples(messageKey);
        expect(samples.length, `no samples for ${category.id}/${messageKey}`).toBeGreaterThan(0);

        for (const sample of samples) {
          const text = renderNotification(sample);
          expect(text.body, `${category.id}/${messageKey} rendered the designed fallback, not the translator`).not.toBe("");
          expect(text.title).not.toContain(category.id);
          expect(text.body).not.toContain(category.id);
        }
      });
    }
  }

  it("v2 is no longer empty (world-notify-source populated it; documents the version transition)", () => {
    expect(categories.length).toBeGreaterThan(0);
  });
});
