import type { ReactNode } from "react";
import type { ContainerView, DisplayLine, Magnitude, Rarity } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { cn } from "@/lib/cn";

/**
 * The item card — the eleven blocks of `ssot-presentation.md` §4.1, in that order.
 *
 * **Two zones, and the split is the layout decision, not a style.** Identity (blocks 1–6) renders
 * above the fold and never collapses; detail (7–11) may fall below it. The panel that hosts this
 * card is 640px wide with a 720px cap and the fully-populated card was measured at 945px of
 * content, so something has to be below the fold — the decision already made is *which*.
 *
 * ⛔ **It renders. It computes nothing.** Every magnitude arrives already resolved and goes through
 * `formatMagnitude`, which is the only thing in this tree that turns a number into text.
 *
 * ⛔ **The disclosure rule:** nothing that can differ between two items of the same base type may be
 * hidden. What collapses is invariant explanation, never a value.
 *
 * `incumbent` exists from day one (GG-47): a card built only to display cannot later be asked to
 * display a difference. The delta table itself is `CompareView`'s; this card only says which item
 * it is being read against.
 */

/** Rarity, in all three channels at once — pips, the rung name in text, and colour. Never colour alone. */
export function RarityPips({ rarity }: { rarity: Rarity }) {
  return (
    <span className="inline-flex items-center gap-1" data-testid="item-card-rarity">
      <span className="inline-flex" aria-hidden="true">
        {Array.from({ length: rarity.pips }, (_, i) => (
          <span
            key={i}
            className="ml-px inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: rarity.colour }}
          />
        ))}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: rarity.colour }}>
        {rarity.display}
      </span>
    </span>
  );
}

/**
 * One block of the card. `collapsible` marks the two the disclosure rule allows to fold; every
 * other block renders open, always.
 */
function Block({
  title,
  testId,
  collapsible = false,
  children
}: {
  title: string;
  testId: string;
  collapsible?: boolean;
  children: ReactNode;
}) {
  const body = <div className="mt-1 text-sm text-text">{children}</div>;
  if (!collapsible) {
    return (
      <section className="border-t border-border px-3 py-2 first:border-t-0" data-testid={testId}>
        <p className="text-2xs font-bold uppercase tracking-wide text-muted">{title}</p>
        {body}
      </section>
    );
  }
  return (
    <details className="border-t border-border px-3 py-2" data-testid={testId}>
      <summary className="cursor-pointer text-2xs font-bold uppercase tracking-wide text-muted">{title}</summary>
      {body}
    </details>
  );
}

function isMagnitude(value: Magnitude | string): value is Magnitude {
  return typeof value === "object" && value !== null && "unit" in value;
}

/**
 * A rendered line binds to a key and its arguments, never to a finished sentence, so a translator
 * can reorder without touching a number.
 *
 * ⭐ **`line.rendered` is the renderer's own sentence** — `ItemDisplayRenderer` composed it from
 * `item_display_template` and the frozen magnitude, and it is what a real affix line shows. This
 * component prefers it and computes nothing.
 *
 * ⚠ A STRUCTURAL line (the header, a requirement clause, the footer) has no template and therefore
 * no sentence. For those the key's own last segment is the label and the args are listed as they
 * arrived — a legible placement for a real line, never an invented number. The `item.card.*` message
 * catalog is still owed by the content side; that is why a key is showing rather than a word.
 */
function LineRow({ line }: { line: DisplayLine }) {
  const label = line.key.split(".").slice(-1)[0]!.replace(/-/g, " ");
  if (line.rendered) {
    return (
      <p className="flex items-baseline justify-between gap-3" data-source-kind={line.sourceKind ?? undefined}>
        <span className="text-text">{line.rendered}</span>
        {line.rollQualityPerMille === undefined ? null : (
          <span className="shrink-0 font-mono text-xs text-muted">
            {formatMagnitude({ unit: "perMilleRatio", value: line.rollQualityPerMille, op: "flat" })}
          </span>
        )}
      </p>
    );
  }

  const parts = Object.entries(line.args).map(([name, value]) =>
    isMagnitude(value) ? formatMagnitude(value) : `${name}: ${value}`
  );
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="capitalize text-muted">{label}</span>
      <span className="font-mono text-text">{parts.join(" · ")}</span>
      {line.context ? <span className="text-xs text-muted">{line.context.text}</span> : null}
    </p>
  );
}

/**
 * `absent` and `pending` are different states and conflating them is the bug the contract exists to
 * prevent — "you have none" must never look the same as "this isn't shown yet".
 */
function Unfilled({ state, reason }: { state: "absent" | "pending"; reason?: string }) {
  if (state === "pending") return <p className="text-xs italic text-muted">{reason}</p>;
  return <p className="text-xs text-muted">None</p>;
}

/**
 * Card block 9's own row shape — item-content `granted-action-text` (T15).
 *
 * `ssot-presentation.md` §9.14 asks for four things on this block: the action's **name**, its
 * **description**, the **battle-only** tag and the **already known** state. A generic `LineRow`
 * shows `rendered` and nothing else, which would drop three of the four.
 *
 * ⛔ Absent text is absent: a key the string catalog has no row for shows nothing rather than the
 * key's own tail — the same rule flavour follows since T6.
 */
function GrantedActionLines({ lines, testId }: { lines: DisplayLine[]; testId: string }) {
  if (lines.length === 0) return <Unfilled state="absent" />;
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, i) => {
        // `args` is `Record<string, string | Magnitude>`; block 9 authors only strings, and a
        // Magnitude here would be a renderer bug rather than a name — so it renders nothing.
        const raw = line.args.__renderedName;
        const name = typeof raw === "string" ? raw : "";
        const battleOnly = line.args.battleOnly === "1";
        const alreadyKnown = line.args.alreadyKnown === "1";
        return (
          <div key={`${line.key}-${i}`} data-source-kind={line.sourceKind ?? undefined}>
            <p className="flex items-baseline gap-2">
              {name ? <span className="font-semibold text-text">{name}</span> : null}
              {battleOnly ? (
                <span className="text-xs text-muted" data-testid={`${testId}-granted-battle-only`}>
                  battle only
                </span>
              ) : null}
              {alreadyKnown ? <span className="text-xs text-muted">already known</span> : null}
            </p>
            {line.rendered ? <p className="text-sm text-muted">{line.rendered}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function Lines({ lines }: { lines: DisplayLine[] }) {
  if (lines.length === 0) return <Unfilled state="absent" />;
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, i) => (
        <LineRow key={`${line.key}-${i}`} line={line} />
      ))}
    </div>
  );
}

export function ItemCard({
  item,
  incumbent,
  className,
  testId = "item-card"
}: {
  item: ContainerView;
  incumbent?: ContainerView | null;
  className?: string;
  testId?: string;
}) {
  const { header } = item;

  // P8.4 — the multi-set per-piece disclosure. `advances` carries EVERY set this piece moves the
  // counter of (the primary one included), and the header line below already names the primary, so
  // what is left to say is the others. Module 12's own measured corpus fact is why it is not a nicety:
  // 25 of the 154 shipped (role, base type) member pairs belong to more than one set, one to three, so
  // without this line a card showing "3 / 4" for one set hides up to two more the piece is advancing.
  const set = item.set;
  const alsoAdvances =
    set.state === "known" ? set.value.advances.filter((name) => name !== set.value.name) : [];

  return (
    <article
      className={cn("rounded-md border border-border bg-panel-raised", className)}
      data-testid={testId}
      data-instance-id={item.instanceId}
    >
      {/* Identity — blocks 1 to 6. Above the fold, never collapsed. */}
      <div data-testid={`${testId}-identity`}>
        {/* 1. Header. Pips first, then the enhancement prefix, then the name: the pips are the
         * rarity ladder's accessibility channel and must not be displaced by an optional token. */}
        <section className="px-3 py-2" data-testid={`${testId}-header`}>
          <RarityPips rarity={header.rarity} />
          <p className="mt-0.5 font-display text-lg leading-tight text-text">
            {header.enhancementPrefix ? (
              <span className="text-lawn-hot">{header.enhancementPrefix}</span>
            ) : null}
            {header.name}
          </p>
          {/* species-gear-chain T26: how far the item climbed. A promoted Fused and a found Fused are
           * different items (ssot-rarity.md §7.2), and this is the one place the card says so. */}
          {header.promotedFromRarity ? (
            <p className="text-xs text-muted" data-testid={`${testId}-promoted-from`}>
              Promoted from {header.promotedFromRarity.display}
            </p>
          ) : null}
          <p className="text-xs text-muted">
            {header.baseTypeAndClassNoun}
            {header.frameBadge ? ` · ${header.frameBadge}` : ""}
            {header.itemLevel === undefined ? "" : ` · level ${header.itemLevel}`}
          </p>
          {incumbent ? (
            <p className="mt-1 text-xs text-muted" data-testid={`${testId}-incumbent`}>
              Compared against {incumbent.header.name}
            </p>
          ) : null}
        </section>

        {/* 2. Requirements — red when unmet, and it names which number gates. */}
        <Block title="Requirements" testId={`${testId}-requirements`}>
          {item.requirements.state === "known" ? (
            <Lines lines={item.requirements.value} />
          ) : (
            <Unfilled
              state={item.requirements.state}
              reason={item.requirements.state === "pending" ? item.requirements.reason : undefined}
            />
          )}
        </Block>

        {/* 3. Base stats — plain numbers, no bars. They are fixed. */}
        <Block title="Base" testId={`${testId}-base-stats`}>
          <Lines lines={item.baseStats} />
        </Block>

        {/* 4. Implicit — separated by a rule, italic, no bar. */}
        <Block title="Implicit" testId={`${testId}-implicit`}>
          {item.implicit.state === "known" ? (
            <div className="italic">
              <Lines lines={item.implicit.value} />
            </div>
          ) : (
            <Unfilled
              state={item.implicit.state}
              reason={item.implicit.state === "pending" ? item.implicit.reason : undefined}
            />
          )}
        </Block>

        {/* 5. Affixes — prefixes then suffixes, each already ordered by the renderer. */}
        <Block title="Affixes" testId={`${testId}-affixes`}>
          {item.affixes.state === "known" ? (
            <Lines lines={item.affixes.value} />
          ) : (
            <Unfilled
              state={item.affixes.state}
              reason={item.affixes.state === "pending" ? item.affixes.reason : undefined}
            />
          )}
        </Block>

        {/* 6. Enhancement — one block, never stacked lines. */}
        <Block title="Enhancement" testId={`${testId}-enhancement`}>
          {item.enhancement.state === "known" ? (
            <div>
              <p>Tier {formatMagnitude({ unit: "count", value: item.enhancement.value.tier })}</p>
              {item.enhancement.value.nextMilestone ? (
                <LineRow line={item.enhancement.value.nextMilestone} />
              ) : null}
            </div>
          ) : (
            <Unfilled
              state={item.enhancement.state}
              reason={item.enhancement.state === "pending" ? item.enhancement.reason : undefined}
            />
          )}
        </Block>
      </div>

      {/* Detail — blocks 7 to 11. May fall below the fold; the last two may also collapse. */}
      <div data-testid={`${testId}-detail`}>
        {/* 7. Sockets — the cells, then what the fill produces. The catalog itself lives in the
         * compendium; active and one-away are never hidden. */}
        <Block title="Sockets" testId={`${testId}-sockets`}>
          {item.sockets.state === "known" ? (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-1">
                {item.sockets.value.cells.length === 0 ? (
                  <span className="text-xs text-muted">No sockets</span>
                ) : (
                  item.sockets.value.cells.map((cell) => (
                    <span
                      key={cell.index}
                      className={cn(
                        "inline-flex min-w-[64px] items-center justify-center rounded-sm border px-2 py-0.5 text-xs",
                        cell.insertName ? "border-lawn-hot text-text" : "border-dashed border-border text-muted"
                      )}
                      data-testid={`${testId}-socket-${cell.index}`}
                    >
                      {cell.insertName ?? "empty"}
                    </span>
                  ))
                )}
              </div>
              {item.sockets.value.cells.some((c) => c.omniCountsDiversityOnly) ? (
                <p className="text-xs text-muted">An omni insert counts toward diversity only.</p>
              ) : null}
              {item.sockets.value.combinations
                .filter((c) => c.state === "active" || c.state === "one-away")
                .map((combo) => (
                  <p
                    key={combo.comboId}
                    className={combo.state === "active" ? "text-text" : "text-muted"}
                    data-testid={`${testId}-combination-${combo.comboId}`}
                    title={combo.comboId}
                  >
                    {/* item-content `item-naming` (T3) — the combination's own words, not its id. */}
                    {combo.title} · {combo.shape}
                    {combo.state === "one-away" && combo.distance !== null
                      ? ` — needs ${formatMagnitude({ unit: "count", value: combo.distance })} more: ${[
                          ...combo.missingFamilies,
                          ...combo.missingElements
                        ].join(", ")}`
                      : ""}
                  </p>
                ))}
            </div>
          ) : (
            <Unfilled
              state={item.sockets.state}
              reason={item.sockets.state === "pending" ? item.sockets.reason : undefined}
            />
          )}
        </Block>

        {/* 8. Set — the count and the WHOLE ladder. Inactive thresholds are the goal; hiding them
         * removes the goal. A threshold names its piece count, never "next". */}
        <Block title="Set" testId={`${testId}-set`}>
          {item.set.state === "known" ? (
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-text">
                {item.set.value.name} {formatMagnitude({ unit: "count", value: item.set.value.count })} /{" "}
                {formatMagnitude({ unit: "count", value: item.set.value.total })}
              </p>
              {item.set.value.ladder.map((tier) => (
                <p
                  key={tier.piecesRequired}
                  className={tier.active ? "text-text" : "text-muted"}
                  data-testid={`${testId}-set-tier-${tier.piecesRequired}`}
                >
                  {formatMagnitude({ unit: "count", value: tier.piecesRequired })} pieces
                  {tier.isCapability ? " — capability" : ""}
                </p>
              ))}
              {item.set.value.redundantIn.length > 0 ? (
                <p className="text-xs text-warn" data-testid={`${testId}-set-redundant`}>
                  Already counted for {item.set.value.redundantIn.join(", ")} — this copy does not add to
                  those. Wearing it is still allowed.
                </p>
              ) : null}
              {alsoAdvances.length > 0 ? (
                <p className="text-xs text-muted" data-testid={`${testId}-set-also-advances`}>
                  Also advances {alsoAdvances.join(", ")}.
                </p>
              ) : null}
            </div>
          ) : (
            <Unfilled
              state={item.set.state}
              reason={item.set.state === "pending" ? item.set.reason : undefined}
            />
          )}
        </Block>

        {/* 9. Granted action — name AND description, plus the battle-only tag and the already-known
            state (`ssot-presentation.md` §9.14). `Lines` would show only the description, because a
            generic line has one sentence and this one has a name beside it. */}
        <Block title="Grants" testId={`${testId}-granted-action`}>
          {item.grantedAction.state === "known" ? (
            <GrantedActionLines lines={item.grantedAction.value} testId={testId} />
          ) : (
            <Unfilled
              state={item.grantedAction.state}
              reason={item.grantedAction.state === "pending" ? item.grantedAction.reason : undefined}
            />
          )}
        </Block>

        {/* 10. Flavour — a unique's or a set's authored prose, italic, may collapse. Absent when
            nothing was authored: no block, no placeholder. `whitespace-pre-line` so a card that
            somehow carries both keeps them as two paragraphs rather than one run-on sentence. */}
        {item.flavour ? (
          <Block title="Flavour" testId={`${testId}-flavour`} collapsible>
            <p className="italic text-muted whitespace-pre-line">{item.flavour}</p>
          </Block>
        ) : null}

        {/* 11. Footer — may collapse. */}
        <Block title="Details" testId={`${testId}-footer`} collapsible>
          {item.footer.state === "known" ? (
            <p className="text-xs text-muted">
              {/* The renderer's own formatted percentage, not a number re-formatted here. */}
              {item.footer.value.meanRollQuality === undefined
                ? "Nothing rolled"
                : `Mean roll ${item.footer.value.meanRollQuality}`}
              {item.footer.value.locked ? " · locked" : ""}
              {item.footer.value.stale ? " · out of date" : ""}
            </p>
          ) : (
            <Unfilled
              state={item.footer.state}
              reason={item.footer.state === "pending" ? item.footer.reason : undefined}
            />
          )}
        </Block>
      </div>
    </article>
  );
}
