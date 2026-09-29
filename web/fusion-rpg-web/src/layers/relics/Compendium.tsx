import { useMemo } from "react";
import { adaptCombinations } from "@/contract/adapt";
import type { Pending } from "@/contract/pending";
import type { CombinationState, CombinationView, PieceSetDisclosureView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { useItemCombinations } from "@/lib/bus/items";
import { cn } from "@/lib/cn";
import { DialogShell } from "@/shell/DialogShell";
import { Banner, Button } from "@/ui";
import { EmptyState } from "@/ui/EmptyState";

/**
 * The combination compendium — a band-3 dialog listing what this item can make, revealed as earned.
 *
 * **The reveal rule is why this exists.** The catalog is far past the size a player can hold in
 * their head, and the alternative to teaching it in-game is an out-of-game wiki. A combination
 * shows up once its ingredients have been held; the list is content the game gives you, not
 * knowledge you import.
 *
 * **Three rendered states, in one order.** Firing, then one away with the exact remedy named, then
 * known-but-not-firing by name only. A combination that has not been revealed is not rendered at
 * all, and the server drops those before they reach the wire.
 *
 * ⛔ **The row cap touches only the name-only tail**, so it can never hide something the player is
 * about to earn.
 *
 * ⛔ **Fully controlled** — the caller's own state decides whether it is open.
 */

const STATE_HEADINGS: { state: CombinationState; heading: string }[] = [
  { state: "active", heading: "Firing now" },
  { state: "one-away", heading: "One away" },
  { state: "known-inactive", heading: "Known, not firing" }
];

function Row({ combo }: { combo: CombinationView }) {
  const missing = [...combo.missingFamilies, ...combo.missingElements];
  return (
    <li
      className={cn(
        "flex items-baseline justify-between gap-2 border-b border-border px-2 py-1 last:border-b-0",
        combo.state === "active" ? "text-text" : "text-muted"
      )}
      data-testid={`compendium-row-${combo.comboId}`}
      data-state={combo.state}
    >
      {/* item-content `item-naming` (T3): the combination's own words. Its id stays on the row's
        * test id and in the title attribute, so nothing debuggable is lost. */}
      <span className="min-w-0 flex-1 truncate font-semibold" title={combo.comboId}>
        {combo.title}
      </span>
      <span className="text-2xs uppercase tracking-wide">{combo.shape}</span>
      {/* Only a one-away row names what it still needs. A known-inactive row is name only — the
       * atoms stay hidden until it is close enough to be a goal. */}
      {combo.state === "one-away" && missing.length > 0 ? (
        <span className="text-xs">
          {formatMagnitude({ unit: "count", value: combo.distance ?? missing.length })} more:{" "}
          {missing.join(", ")}
        </span>
      ) : null}
      {combo.state === "active" ? (
        <span className="text-xs">tier {formatMagnitude({ unit: "count", value: combo.grantedTier })}</span>
      ) : null}
    </li>
  );
}

export function Compendium({
  open,
  onOpenChange,
  instanceId,
  itemName,
  playerId,
  setDisclosure
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  itemName: string;
  playerId: number;
  /** Which sets each worn piece advances, and which it is redundant in. */
  setDisclosure: Pending<PieceSetDisclosureView[]>;
}) {
  const query = useItemCombinations(open ? instanceId : null, playerId);
  const combinations = useMemo(() => (query.data ? adaptCombinations(query.data) : []), [query.data]);

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Compendium"
      subtitle={itemName}
      testId="compendium"
      footer={
        <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {query.isLoading ? (
          <p className="text-sm text-muted" data-testid="compendium-loading" aria-busy="true">
            Reading what you've learned…
          </p>
        ) : query.isError ? (
          <Banner tone="error" data-testid="compendium-error">
            Couldn't read what you've learned.
            <Button size="sm" variant="ghost" className="ml-2" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </Banner>
        ) : combinations.length === 0 ? (
          <EmptyState
            title="Nothing learned yet"
            hint="Hold each of a combination's ingredients once and it is written down here."
            testId="compendium-empty"
          />
        ) : (
          STATE_HEADINGS.map(({ state, heading }) => {
            const rows = combinations.filter((c) => c.state === state);
            if (rows.length === 0) return null;
            return (
              <div key={state} data-testid={`compendium-band-${state}`}>
                <p className="text-2xs font-bold uppercase tracking-wide text-muted">{heading}</p>
                <ul className="mt-1 rounded-md border border-border">
                  {rows.map((c) => (
                    <Row key={c.comboId} combo={c} />
                  ))}
                </ul>
              </div>
            );
          })
        )}

        <div data-testid="compendium-set-disclosure">
          <p className="text-2xs font-bold uppercase tracking-wide text-muted">Sets you are building</p>
          {setDisclosure.state === "known" ? (
            setDisclosure.value.length === 0 ? (
              <p className="mt-1 text-xs text-muted">Nothing you are wearing belongs to a set.</p>
            ) : (
              <ul className="mt-1 rounded-md border border-border">
                {setDisclosure.value.map((piece) => (
                  <li
                    key={piece.instanceId}
                    className="border-b border-border px-2 py-1 last:border-b-0"
                    data-testid={`compendium-set-piece-${piece.instanceId}`}
                  >
                    <span className="block truncate text-sm text-text">{piece.itemName}</span>
                    {piece.advances.length > 0 ? (
                      <span className="block text-xs text-muted">Counts toward {piece.advances.join(", ")}</span>
                    ) : null}
                    {/* The "say why the fourth did not count" half — a disclosure, never a refusal. */}
                    {piece.redundantIn.length > 0 ? (
                      <span className="block text-xs text-warn">
                        Already counted for {piece.redundantIn.join(", ")} — this copy adds nothing there,
                        and wearing it is still fine.
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          ) : setDisclosure.state === "pending" ? (
            <p className="mt-1 text-xs italic text-muted">{setDisclosure.reason}</p>
          ) : (
            <p className="mt-1 text-xs text-muted">Nothing you are wearing belongs to a set.</p>
          )}
        </div>
      </div>
    </DialogShell>
  );
}
