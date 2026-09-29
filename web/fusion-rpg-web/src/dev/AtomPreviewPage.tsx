import { useState } from "react";
import { adaptItemCard } from "@/contract/adapt";
import { Page } from "@/layouts/Page";
import { ItemCard } from "@/layers/relics/ItemCard";
import { useItemPreview, type ItemPreviewRequestDto } from "@/lib/bus/items";
import { Banner, Button, HelpText, Panel } from "@/ui";

/**
 * item-content module `atom-preview` (T9) — **what a container renders as, before it is saved**.
 *
 * The workflow this replaces was: hand-edit JSON under `gk-data/packs/fusion/data/seed/items/**`, run a console validator,
 * read a text report, and never actually see the sentence a player would read. This page posts the
 * definition to `POST /api/items/preview/card` and draws the answer with the same `ItemCard`
 * component the live item surfaces use.
 *
 * ⛔ **Nothing here computes a value, and nothing here is a literal.** Every number and every sentence
 * on the three cards is the server's own render of the definition in the box — `ItemCardRenderer` via
 * `adaptItemCard`, the same adapter `GET /api/items/{id}/card` already feeds. The only thing this file
 * decides is layout.
 *
 * ⛔ **No save button, deliberately.** The preview never persists the definition, matching the item
 * card route's own "no write path" stance. Authoring still happens in the seed files.
 *
 * ⚠ **Paste-only today, and that is a real gap rather than a design choice.** No server route lists
 * atoms, affixes or containers (`AtomPushService.cs:17-19` — "no atom row, container row or curve row
 * is ever put on the wire"), so there is nothing for a picker to read. The placeholder below is the
 * request's field list, not content.
 */

/** The request's own field names, as a shape an author fills in — documentation, never a submitted
 * value, and never prefilled: an invented atom id would only ever render a refusal. */
const SHAPE_HINT = `{
  "containerId": "item.my-draft-blade",
  "kind": "Item",
  "slot": "armament-primary",
  "rarity": "heirloom",
  "levelReq": 20,
  "prefixRolls": 4,
  "suffixRolls": 0,
  "atoms": [{ "seq": 0, "atomId": "<a real atom id>" }],
  "pool": [{ "affixId": "<a real affix id>", "weight": 100 }],
  "baseTypeId": "<a real base type id>",
  "rollSeed": 12648430,
  "itemLevel": 24
}`;

/** The card at both ends of the authored range is the point of the page, so each one says which end
 * it is in the reader's own words rather than leaving three identical-looking cards side by side. */
const MODE_LABEL: Record<string, string> = {
  rolled: "As rolled",
  min: "Minimum of the authored range",
  max: "Maximum of the authored range"
};

export function AtomPreviewPage() {
  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const preview = useItemPreview();

  function submit() {
    setParseError(null);
    let body: ItemPreviewRequestDto;
    try {
      body = JSON.parse(text) as ItemPreviewRequestDto;
    } catch (e) {
      // A JSON syntax error is the author's, and saying so beats sending it and getting a 400 back.
      setParseError(e instanceof Error ? e.message : "the definition is not valid JSON");
      return;
    }
    preview.mutate(body);
  }

  const result = preview.data ?? null;

  return (
    <Page
      testId="page-atom-preview"
      title="Container preview"
      description="Post an unsaved container definition and see the card it renders — through the same renderer the game uses. Nothing is saved."
    >
      <Panel
        title="Definition"
        description="Every field down to `pool` is `ContainerRow`'s own, so a container you are about to author pastes in unchanged."
        testId="atom-preview-input"
        actions={
          <Button
            data-testid="atom-preview-submit"
            onClick={submit}
            disabled={preview.isPending || text.trim().length === 0}
            // GG-55: a disabled control says why, on hover and on focus.
            title={
              preview.isPending
                ? "Waiting for the render already in flight"
                : text.trim().length === 0
                  ? "Paste a container definition first"
                  : "Render this definition"
            }
          >
            {preview.isPending ? "Rendering…" : "Render"}
          </Button>
        }
      >
        <textarea
          data-testid="atom-preview-json"
          aria-label="Container definition"
          spellCheck={false}
          rows={14}
          placeholder={SHAPE_HINT}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-sm border border-border bg-panel-raised p-2 font-mono text-xs text-text"
        />
        <HelpText>
          The atoms, affixes and display templates come from the shipped catalog; only the container is
          unsaved. Omit `rollSeed` for a reproducible draw from seed 0, and omit `thetaContent` to
          render at the power ladder&apos;s own pin, where content scale is ×1.000.
        </HelpText>
      </Panel>

      {parseError ? (
        <Banner tone="error" data-testid="atom-preview-parse-error">
          {parseError}
        </Banner>
      ) : null}

      {preview.isError ? (
        // The server's own named rule, verbatim — an author needs the refusal, not a rewrite of it.
        <Banner tone="error" data-testid="atom-preview-error">
          {preview.error instanceof Error ? preview.error.message : "the preview was refused"}
        </Banner>
      ) : null}

      {result ? (
        <Panel
          title={result.containerId}
          description={
            <span data-testid="atom-preview-meta">
              seed {result.rollSeed} · Θ_content {result.thetaContent} · content scale{" "}
              {result.contentScaleMilli}‰
            </span>
          }
          testId="atom-preview-result"
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {result.cards.map((entry) => (
              <div key={entry.mode} data-testid={`atom-preview-card-${entry.mode}`}>
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">
                  {MODE_LABEL[entry.mode] ?? entry.mode}
                </p>
                <ItemCard item={adaptItemCard(entry.card)} testId={`item-card-${entry.mode}`} />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </Page>
  );
}
