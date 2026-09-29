import { useState } from "react";
import { adaptWorkbenchOutcome, idWords } from "@/contract/adapt";
import type { WorkbenchOutcomeView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { newCorrelationId } from "@/lib/bus/creatures";
import {
  useEnhanceItem,
  useSalvageItem,
  useUpcycleMaterials,
  useUpgradeItem,
  useUpgradePreview,
  useWorkbenchRecipes,
  type WorkbenchOutcomeDto,
  type WorkbenchUpgradePreviewDto
} from "@/lib/bus/items";
import { DialogShell } from "@/shell/DialogShell";
import { Banner, Button, Field, Select } from "@/ui";

/**
 * The craft bench — item modules 14 and 15's verbs, against the real
 * `POST /api/items/workbench/*` executor. A band-3 dialog pushed from the item detail, so the depth
 * budget stays at three: Relics, item, bench.
 *
 * ⛔ **Nothing here prices anything.** Every quantity on screen is a line the server resolved and
 * sent back in the operation's own reply — there is no cost preview, because no route prices an
 * operation before it runs and a client-composed estimate would be a second, disagreeing price.
 *
 * ⛔ **A refusal is the server's sentence, verbatim.** The executor answers 409 with the named rule
 * (`item.locked`, `material.recipe-unknown`, `ContentRuleViolated{…}`) and this surface prints it
 * rather than translating it into something friendlier and less true.
 *
 * ⭐ **The recipe is PICKED, by its real name** (item-content `item-naming` T4, 2026-09-06). It used
 * to be typed, because the shipped 30-row corpus had no read route at all — `GET /api/recipes` is
 * the PvZ fusion table, a different thing entirely. `GET /api/items/workbench/recipes` now serves
 * it, reading `ItemWorkbench.Recipes` itself, so the list a player picks from is the same corpus the
 * very next POST prices against and no offered row can come back `material.recipe-unknown`. Nothing
 * is hard-coded here: a second copy of the corpus in the browser was the wrong fix then and now.
 */

/**
 * A verb that spends is only offered once the player has picked the recipe that prices it.
 *
 * **One picker shape, not a second one.** `ArmouryList` establishes the pattern this reuses: the
 * real name is the row's own line, the id is never the label, and the four honest states (loading,
 * error, empty, ready) are four different sentences. A `Select` rather than that list's virtualised
 * scroller because the corpus is 30 rows narrowed by `operation` to a handful — the same `Select`
 * the equip-role and equip-target controls in this same layer already use.
 */
export function RecipeField({
  label,
  hint,
  value,
  onChange,
  operation,
  testId
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  /** The verb this control runs, so the list never offers a recipe the executor would refuse. */
  operation: string;
  testId: string;
}) {
  const recipes = useWorkbenchRecipes(operation);
  const rows = recipes.data ?? [];

  if (recipes.isLoading) {
    return (
      <Field label={label} hint={hint}>
        <p className="text-sm text-muted" data-testid={`${testId}-loading`} aria-busy="true">
          Reading the recipe book…
        </p>
      </Field>
    );
  }

  if (recipes.isError) {
    return (
      <Field label={label} hint={hint}>
        <Banner tone="error" data-testid={`${testId}-error`}>
          Couldn't read the recipe book.
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => void recipes.refetch()}>
            Retry
          </Button>
        </Banner>
      </Field>
    );
  }

  if (rows.length === 0) {
    return (
      <Field label={label} hint={hint}>
        <p className="text-sm text-muted" data-testid={`${testId}-empty`}>
          Nothing has been written for this yet.
        </p>
      </Field>
    );
  }

  return (
    <Field label={label} hint={hint}>
      <Select
        data-testid={testId}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Pick one…</option>
        {rows.map((r) => (
          // ⛔ The id is the option's VALUE, never its text. A recipe with no authored name says so
          // rather than showing `recipe.014` where a name belongs.
          <option key={r.recipeId} value={r.recipeId}>
            {r.name.length > 0 ? r.name : UNNAMED_RECIPE}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** A corpus row that authors no `name`. Every shipped one does; this is the honest shape if one stops. */
const UNNAMED_RECIPE = "Unnamed recipe";

function CostLines({
  title,
  lines,
  testId
}: {
  title: string;
  lines: WorkbenchOutcomeView["spent"];
  testId: string;
}) {
  if (lines.length === 0) return null;
  return (
    <div data-testid={testId}>
      <p className="text-2xs font-bold uppercase tracking-wide text-muted">{title}</p>
      {lines.map((line) => (
        <p key={`${line.materialClass}-${line.materialId}`} className="flex items-baseline justify-between gap-3 text-sm">
          {/* item-content `item-naming` (T3/T4): the material's own words. The 27 material ids are
            * STRUCTURALLY generated (`MaterialCatalog` builds them from the rarity ladder, the two
            * frames × four grades, the element roster and the three catalyst verbs) and no corpus
            * authors a name for one — so this is the same placement `channelLabel` documents, and
            * nothing English is invented. Named gap, owner module 14. */}
          <span className="truncate text-muted" title={line.materialId}>
            {idWords(line.materialId)}
          </span>
          <span className="font-mono text-text">{formatMagnitude(line.qty)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * What the last operation did.
 *
 * ⚠ **A 200 is not a success.** A failed enhance still spends, still records an op and still moves
 * the pity counter, so this reads `outcome` and never the transport status — showing "done" over a
 * `failure` is exactly the "pretend it worked" the honest-state rule forbids.
 */
export function WorkbenchResult({
  outcome,
  testId = "workbench-result"
}: {
  outcome: WorkbenchOutcomeView;
  testId?: string;
}) {
  const failedRoll = outcome.outcome === "failure" || outcome.outcome === "failure-downgrade";
  return (
    <div
      className="rounded-md border border-border bg-panel-raised p-3"
      data-testid={testId}
      data-verb={outcome.verb}
      data-outcome={outcome.outcome}
    >
      <p className={failedRoll ? "font-semibold text-warn" : "font-semibold text-text"}>
        {outcome.verb} — {outcome.outcome}
        {outcome.replayed ? " (already done — this is the recorded result)" : ""}
      </p>

      {failedRoll ? (
        <p className="mt-0.5 text-xs text-muted">
          It did not take. The materials are spent either way, and the pity counter moved.
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-2">
        <CostLines title="Spent" lines={outcome.spent} testId={`${testId}-spent`} />
        <CostLines title="Gained" lines={outcome.granted} testId={`${testId}-granted`} />

        {outcome.verb === "enhance" ? (
          <p className="text-sm text-muted" data-testid={`${testId}-enhance`}>
            Now at +{formatMagnitude(outcome.enhanceLevel)} · pity{" "}
            {formatMagnitude(outcome.pityCounter)}
            {outcome.successChance ? ` · rolled at ${formatMagnitude(outcome.successChance)}` : ""}
          </p>
        ) : null}

        {outcome.sockets.length > 0 ? (
          <div data-testid={`${testId}-sockets`}>
            <p className="text-2xs font-bold uppercase tracking-wide text-muted">Sockets now</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {outcome.sockets.map((socket) => (
                <span
                  key={socket.index}
                  className={
                    socket.insertContainerId
                      ? "inline-flex min-w-[64px] flex-col items-center rounded-sm border border-lawn-hot px-2 py-1 text-xs text-text"
                      : "inline-flex min-w-[64px] flex-col items-center rounded-sm border border-dashed border-border px-2 py-1 text-xs text-muted"
                  }
                  data-testid={`${testId}-socket-${socket.index}`}
                  title={socket.insertContainerId ?? undefined}
                >
                  {/* item-content T4: the gem corpus's own authored name, off the operation's reply.
                    * A filled cell whose container the corpus does not carry says so rather than
                    * showing `gem.g1-001` as if that were the insert's name. */}
                  <span>
                    {socket.insertContainerId === null
                      ? "empty"
                      : socket.insertName ?? "unknown insert"}
                  </span>
                  {socket.affinity ? <span className="text-2xs text-muted">{socket.affinity}</span> : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A refusal, printed as the server named it. */
export function WorkbenchRefusal({ error, testId }: { error: Error; testId: string }) {
  return (
    <Banner tone="error" data-testid={testId}>
      {error.message}
    </Banner>
  );
}

/**
 * The last thing the bench did, whichever verb did it.
 *
 * A bench runs several verbs against one item, and each mutation hook keeps its own `data`. Reading
 * them in a fixed order would leave a stale enhance result on screen after a salvage — so the
 * result is held once, here, and the per-call handlers replace it. Both slots clear on the way in,
 * so a refusal never lingers beside the reply that followed it.
 */
/**
 * species-gear-chain T37 — the upgrade's swap, as the card shows it: the outgoing and incoming
 * implicit, how many affixes come across, and what the verb costs. ⭐ It says in words that the result
 * is a chassis carrying its OWN identity, because Success criterion 5 is exactly that sentence: an
 * upgraded piece is not "a Leather Vest", and a surface that implies otherwise is the D2 failure the
 * spec cites. `preview` null = not asked yet; `!ok` = a named refusal, shown instead of a swap.
 */
export function UpgradeSwapLine({
  preview
}: {
  preview: WorkbenchUpgradePreviewDto | null;
}) {
  if (preview?.ok) {
    return (
      <p className="text-sm" data-testid="craft-upgrade-swap">
        {preview.outgoingImplicitFamily || "no implicit"} → {preview.incomingImplicitFamily || "no implicit"} ·{" "}
        {preview.carriedAffixCount.toLocaleString()} affixes carried · {preview.soulsCost.toLocaleString()} souls ·{" "}
        carries its own identity, not the named successor
      </p>
    );
  }
  if (preview && !preview.ok) {
    return (
      <p className="text-sm text-muted" data-testid="craft-upgrade-refusal">
        {preview.reason}
      </p>
    );
  }
  return (
    <p className="text-sm text-muted" data-testid="craft-upgrade-hint">
      Preview first — the successor chassis and the implicit it brings are shown before the piece is consumed.
    </p>
  );
}

/**
 * species-gear-chain T37 — an upgrade CONSUMES the piece the bench is opened on and returns a DIFFERENT
 * instance (the successor; the verb puts its id in `instanceId`). Without this line the panel would keep
 * showing the consumed item's bench as if nothing had happened. Silent for every other verb and for any
 * outcome that did not consume anything.
 */
export function UpgradeConsumedNotice({
  outcome,
  openedInstanceId
}: {
  outcome: WorkbenchOutcomeDto;
  openedInstanceId: string;
}) {
  if (outcome.verb !== "upgrade" || outcome.outcome !== "upgraded") return null;
  if (outcome.instanceId === openedInstanceId) return null;
  return (
    <p className="text-sm text-muted" data-testid="craft-upgrade-consumed">
      The piece you opened was consumed. Its successor is a new item — open the bench on it to keep working.
    </p>
  );
}

export function useWorkbenchFeedback() {  const [last, setLast] = useState<WorkbenchOutcomeDto | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);

  return {
    last,
    failure,
    /** Spread into `mutate(req, handlers())` — clears the previous pair first. */
    handlers() {
      setLast(null);
      setFailure(null);
      return {
        onSuccess: (dto: WorkbenchOutcomeDto) => setLast(dto),
        onError: (error: Error) => setFailure(error)
      };
    }
  };
}

/**
 * Verbs the item program designed and the server does not serve, each with the real reason. They
 * are listed rather than drawn as controls: a button that can only fail is worse than an absent
 * one, because it looks wired.
 */
const UNAVAILABLE_VERBS: { verb: string; reason: string }[] = [
  {
    verb: "Forge",
    reason:
      "Forging mints a new item, and nothing has authored an effect container for a base type yet — there is nothing for a forge recipe to produce."
  },
  {
    verb: "Reroll",
    reason: "Rerolling an item's rolled bonuses has no resolver behind it yet."
  },
  {
    verb: "Transfer",
    reason: "Moving a bonus between two items needs an ask-first operation the workbench does not carry yet."
  }
];

export function UnavailableVerbs({ testId = "workbench-unavailable" }: { testId?: string }) {
  return (
    <div data-testid={testId}>
      <p className="text-2xs font-bold uppercase tracking-wide text-muted">Not available yet</p>
      <ul className="mt-1 flex flex-col gap-1">
        {UNAVAILABLE_VERBS.map((row) => (
          <li key={row.verb} className="text-xs text-muted" data-testid={`${testId}-${row.verb.toLowerCase()}`}>
            <b className="text-text">{row.verb}</b> — {row.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The craft bench dialog: salvage the item, strengthen it, or refine loose materials.
 *
 * `instanceId` is the selected armoury row's, so every verb here acts on the item the player is
 * already looking at — the upcycle verb is the one exception and touches no item at all.
 */
export function CraftBench({
  open,
  onOpenChange,
  instanceId,
  itemName,
  playerId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  itemName: string;
  playerId: number;
}) {
  const [enhanceRecipe, setEnhanceRecipe] = useState("");
  const [upcycleRecipe, setUpcycleRecipe] = useState("");

  const salvage = useSalvageItem();
  const enhance = useEnhanceItem();
  const upcycle = useUpcycleMaterials();
  const upgrade = useUpgradeItem();
  const upgradePreview = useUpgradePreview();
  const { last, failure, handlers } = useWorkbenchFeedback();

  const busy =
    salvage.isPending || enhance.isPending || upcycle.isPending || upgrade.isPending ||
    upgradePreview.isPending;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Craft bench"
      subtitle={itemName}
      testId="craft-bench"
      footer={
        <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {busy ? (
          <p className="text-sm text-muted" data-testid="craft-bench-busy" aria-busy="true">
            Working the bench…
          </p>
        ) : null}

        {failure ? <WorkbenchRefusal error={failure} testId="craft-bench-error" /> : null}

        {last ? <WorkbenchResult outcome={adaptWorkbenchOutcome(last)} testId="craft-bench-result" /> : null}
        {last ? <UpgradeConsumedNotice outcome={last} openedInstanceId={instanceId} /> : null}

        {/* Strengthen — module 15. A failed attempt still spends, and the result panel says so. */}
        <div className="flex flex-col gap-1">
          <p className="text-2xs font-bold uppercase tracking-wide text-muted">Strengthen</p>
          <RecipeField
            label="Temper recipe"
            hint="Pick the temper the bench should price this by."
            operation="temper"
            value={enhanceRecipe}
            onChange={setEnhanceRecipe}
            testId="craft-enhance-recipe"
          />
          <div>
            <Button
              size="sm"
              data-testid="craft-enhance-btn"
              disabled={busy || enhanceRecipe.trim().length === 0}
              title={
                busy
                  ? "The bench is busy"
                  : enhanceRecipe.trim().length === 0
                    ? "Pick a temper recipe first"
                    : undefined
              }
              onClick={() =>
                enhance.mutate(
                  {
                    playerId,
                    instanceId,
                    recipeId: enhanceRecipe.trim(),
                    correlationId: newCorrelationId()
                  },
                  handlers()
                )
              }
            >
              Strengthen
            </Button>
          </div>
        </div>

        {/* Upgrade — species-gear-chain T37. The preview runs the verb's own decision and writes
            nothing, so the successor chassis and the implicit it brings are on screen BEFORE the
            piece is consumed (spec § 2a Rule 2), and the commit stays disabled until that preview
            succeeded. The result is a DIFFERENT instance: a chassis carrying its own identity, never
            the named successor (Success criterion 5). */}
        <div className="flex flex-col gap-1">
          <p className="text-2xs font-bold uppercase tracking-wide text-muted">Upgrade</p>
          <UpgradeSwapLine preview={upgradePreview.data ?? null} />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              data-testid="craft-upgrade-preview-btn"
              disabled={busy}
              // GG-55: a disabled control says why. `busy` is the only cause here, and "Working…"
              // is the string the sibling screens already use for it (LawnPage, StoragePage) —
              // without it `disabledReasonGuard` fails on the real tree.
              title={busy ? "Working…" : undefined}
              onClick={() => upgradePreview.mutate({ playerId, instanceId })}
            >
              Preview upgrade
            </Button>
            <Button
              size="sm"
              data-testid="craft-upgrade-btn"
              disabled={busy || !upgradePreview.data?.ok}
              // Two independent causes: a request in flight, or no successful preview yet. The
              // earlier form named only the second, so a busy-but-previewed button was disabled
              // with nothing to explain it (GG-55 wants the reason on the control, not on one path).
              title={
                busy ? "Working…" : upgradePreview.data?.ok ? undefined : "Preview the upgrade first"
              }
              onClick={() =>
                upgrade.mutate(
                  { playerId, instanceId, correlationId: newCorrelationId() },
                  handlers()
                )
              }
            >
              Upgrade
            </Button>
          </div>
        </div>

        {/* Refine — module 14's material-to-material verb. Touches no item. */}
        <div className="flex flex-col gap-1">
          <p className="text-2xs font-bold uppercase tracking-wide text-muted">Refine materials</p>
          <RecipeField
            label="Upcycle recipe"
            hint="Turns several of one grade into one of the next. It uses no item."
            operation="upcycle"
            value={upcycleRecipe}
            onChange={setUpcycleRecipe}
            testId="craft-upcycle-recipe"
          />
          <div>
            <Button
              size="sm"
              data-testid="craft-upcycle-btn"
              disabled={busy || upcycleRecipe.trim().length === 0}
              title={
                busy
                  ? "The bench is busy"
                  : upcycleRecipe.trim().length === 0
                    ? "Pick an upcycle recipe first"
                    : undefined
              }
              onClick={() =>
                upcycle.mutate(
                  { playerId, recipeId: upcycleRecipe.trim(), correlationId: newCorrelationId() },
                  handlers()
                )
              }
            >
              Refine
            </Button>
          </div>
        </div>

        {/* Break down — module 14. No recipe and no debit: the yield is a credit. */}
        <div className="flex flex-col gap-1">
          <p className="text-2xs font-bold uppercase tracking-wide text-muted">Break down</p>
          <p className="text-xs text-muted">
            Turns this one back into materials. It cannot be undone, and a locked item is refused.
          </p>
          <div>
            <Button
              size="sm"
              variant="danger"
              data-testid="craft-salvage-btn"
              disabled={busy}
              title={busy ? "The bench is busy" : undefined}
              onClick={() => salvage.mutate({ playerId, instanceId }, handlers())}
            >
              Break down
            </Button>
          </div>
        </div>

        <UnavailableVerbs />
      </div>
    </DialogShell>
  );
}
