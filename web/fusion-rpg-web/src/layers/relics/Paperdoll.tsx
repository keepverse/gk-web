import type { ItemRoleId, PaperdollCellView, Rarity } from "@/contract/types";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/ui/EmptyState";
import { RarityPips } from "./ItemCard";

/**
 * The equip screen — fifteen body roles against one specimen, plus the reserved commander slot.
 *
 * **Bounded by construction.** Sixteen cells is the whole population at every magnitude, so this
 * surface has no render band and needs none.
 *
 * **Two frame vocabularies, both shown.** A role's name depends on the item's frame — `main-hand`
 * on a humanoid is `muzzle` on a plant — and nothing on the wire says which frame a worn item was
 * made for yet. Showing both names is the honest answer; picking one would be a guess that reads
 * as fact.
 *
 * **An empty role is a designed state, not a blank.** Each cell says which role it is even when
 * nothing fills it, because an equip screen that renders only what you own cannot show you what
 * you are missing.
 */

/**
 * `core.v1.json`'s own `roles.list[]` and `roles.commanderOnly[]`, in registry order. Names are
 * that file's `humanoidName` / `plantName`; the registry is append-only, so this list is closed
 * until a registry version bump adds to it.
 */
export const ROLE_REGISTRY: { role: ItemRoleId; humanoidName: string; plantName: string; hybridEligible: boolean }[] = [
  { role: "armament-primary", humanoidName: "main-hand", plantName: "muzzle", hybridEligible: true },
  { role: "core-guard", humanoidName: "torso", plantName: "stem", hybridEligible: true },
  { role: "ward-array", humanoidName: "shoulders", plantName: "sheath", hybridEligible: false },
  { role: "armament-secondary", humanoidName: "off-hand", plantName: "thorn", hybridEligible: true },
  { role: "jewel-major", humanoidName: "neck", plantName: "pollen", hybridEligible: true },
  { role: "manipulator", humanoidName: "hands", plantName: "leaves", hybridEligible: true },
  { role: "mantle", humanoidName: "back", plantName: "canopy", hybridEligible: true },
  { role: "head-guard", humanoidName: "head", plantName: "crown", hybridEligible: false },
  { role: "girdle", humanoidName: "waist", plantName: "soil", hybridEligible: true },
  { role: "sense", humanoidName: "face", plantName: "bract", hybridEligible: false },
  { role: "footing", humanoidName: "feet", plantName: "roots", hybridEligible: true },
  { role: "infusion", humanoidName: "bandolier", plantName: "glands", hybridEligible: true },
  { role: "retinue", humanoidName: "horn", plantName: "runner", hybridEligible: true },
  { role: "jewel-minor-a", humanoidName: "ring-1", plantName: "graft-1", hybridEligible: true },
  { role: "jewel-minor-b", humanoidName: "ring-2", plantName: "graft-2", hybridEligible: true },
  { role: "standard", humanoidName: "banner", plantName: "root-totem", hybridEligible: false }
];

/**
 * The three relic slots the shipped equip pipeline speaks, mapped onto the roles they are the same
 * thing as. A narrow, honest bridge while the payload still carries three slot words instead of
 * the fifteen roles — widening it moves the wire and this table together, not one of them alone.
 *
 * ⚠ **R3, corrected 2026-09-08 — `trinket` now agrees with the server's own alias map.**
 * `LegacyEquipSlots` (Core, `ssot-equip-slots.md` §5.7 step 1's own named decision) maps
 * `trinket → jewel-minor-a`; this table previously said `jewel-major`, disagreeing with it.
 * Reconciling moves NO stored data — `LegacyEquipSlots` is what module 4's migration actually wrote
 * to `rpg_item_assignment` (real `jewel-minor-a` rows), so this table was the one out of step with
 * reality, not the other way around. Left unreconciled, a real item equipped at `jewel-minor-a`
 * (ring-1) would collide in storage with a "trinket" relic the paperdoll was drawing at a different
 * cell (neck) — a correctness bug, not just a cosmetic mismatch.
 */
const RELIC_SLOT_TO_ROLE: Record<string, ItemRoleId> = {
  weapon: "armament-primary",
  armor: "core-guard",
  trinket: "jewel-minor-a"
};

/**
 * One worn piece, from either of the two flows that write `rpg_item_assignment`.
 *
 * A relic arrives with the legacy three-word `slot`; an item arrives with its real fifteen-role
 * `role`. Both are given, never guessed — a piece with neither fills no cell rather than a
 * plausible wrong one.
 */
export type PaperdollWorn = {
  /** The relic flow's slot word (`weapon`/`armor`/`trinket`), when this came from there. */
  slot?: string;
  /** The registry role id, when this is an item assignment. */
  role?: ItemRoleId;
  instanceId: string;
  itemName: string;
  /** `null` when the catalog does not know this piece — a missing swatch, never an invented rung. */
  rarity: Rarity | null;
  /** Which flow owns taking it off again. Defaults to the relic flow, which is what shipped first. */
  source?: "item" | "relic";
};

/** Fills the sixteen cells from what the specimen is actually wearing. Nothing is invented. */
export function paperdollCells(worn: PaperdollWorn[]): PaperdollCellView[] {
  const byRole = new Map<ItemRoleId, PaperdollWorn>();
  for (const piece of worn) {
    const role = piece.role ?? (piece.slot ? RELIC_SLOT_TO_ROLE[piece.slot] : undefined);
    if (role && !byRole.has(role)) byRole.set(role, piece);
  }
  return ROLE_REGISTRY.map((entry) => {
    const filled = byRole.get(entry.role);
    return {
      role: entry.role,
      humanoidName: entry.humanoidName,
      plantName: entry.plantName,
      hybridEligible: entry.hybridEligible,
      instanceId: filled?.instanceId ?? null,
      itemName: filled?.itemName ?? null,
      rarity: filled?.rarity ?? null,
      source: filled ? filled.source ?? "relic" : null
    };
  });
}

const CELL_SHAPE = "flex min-h-[52px] flex-col justify-center rounded-sm border px-2 py-1 text-left";

function RoleName({ cell }: { cell: PaperdollCellView }) {
  return (
    <span className="truncate text-2xs uppercase tracking-wide text-muted">
      {cell.humanoidName} / {cell.plantName}
    </span>
  );
}

/**
 * An empty role renders as a labelled space, never as a dead button. A control that cannot do
 * anything should not be offered and then refused — there is nothing to explain, because there is
 * nothing to press.
 */
function Cell({
  cell,
  selected,
  onSelect,
  onUnequip,
  busy
}: {
  cell: PaperdollCellView;
  selected: boolean;
  onSelect: () => void;
  /** Absent when this screen has no write path — the control is then not drawn at all. */
  onUnequip?: () => void;
  busy: boolean;
}) {
  if (cell.instanceId === null) {
    return (
      <div
        data-testid={`paperdoll-cell-${cell.role}`}
        data-filled={false}
        className={cn(CELL_SHAPE, "border-dashed border-border text-muted")}
      >
        <RoleName cell={cell} />
        <span className="text-xs italic">empty</span>
      </div>
    );
  }

  // ⛔ Only an item cell offers "take off". A relic's own write path rebuilds `mods_json` and its
  // atom bindings in the same call, so removing one from here would leave both standing — the
  // server refuses it by name, and drawing a control that can only be refused is worse than
  // saying where the action lives.
  const canUnequip = cell.source === "item" && onUnequip !== undefined;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        data-testid={`paperdoll-cell-${cell.role}`}
        data-filled={true}
        data-selected={selected}
        data-source={cell.source ?? ""}
        aria-current={selected}
        onClick={onSelect}
        className={cn(
          CELL_SHAPE,
          "border-border bg-panel-raised text-text hover:bg-panel",
          selected ? "border-lawn-hot" : ""
        )}
      >
        <RoleName cell={cell} />
        <span className="truncate text-xs font-semibold">{cell.itemName}</span>
        {cell.rarity ? <RarityPips rarity={cell.rarity} /> : null}
      </button>

      {canUnequip ? (
        <button
          type="button"
          data-testid={`paperdoll-unequip-${cell.role}`}
          disabled={busy}
          title={busy ? "Still working on the last change" : undefined}
          onClick={onUnequip}
          className="rounded-sm border border-border px-2 py-0.5 text-2xs text-muted hover:bg-panel disabled:opacity-50"
        >
          Take off
        </button>
      ) : cell.source === "relic" ? (
        <span className="px-2 text-2xs text-muted" data-testid={`paperdoll-relic-note-${cell.role}`}>
          Relic — take it off on the Held tab
        </span>
      ) : null}
    </div>
  );
}

export function Paperdoll({
  worn,
  selectedId,
  onSelect,
  onUnequip,
  busy = false
}: {
  worn: PaperdollWorn[];
  selectedId: string | null;
  onSelect: (instanceId: string | null) => void;
  /** Called with the role to clear. Omitted when the caller has no write path to offer. */
  onUnequip?: (role: PaperdollCellView["role"]) => void;
  busy?: boolean;
}) {
  const cells = paperdollCells(worn);
  const filledCount = cells.filter((c) => c.instanceId !== null).length;

  return (
    <div className="flex flex-col gap-2" data-testid="relics-equipped-list">
      <p className="text-xs text-muted">
        {filledCount === 0
          ? "Nothing equipped"
          : `${filledCount} of ${cells.length} slots filled`}
      </p>

      {filledCount === 0 ? (
        <EmptyState
          title="Nothing equipped"
          hint="Equip a held relic from the Held tab, or an item you found from the Armoury tab."
        />
      ) : null}

      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3" data-testid="paperdoll">
        {cells.map((cell) => (
          <Cell
            key={cell.role}
            cell={cell}
            selected={cell.instanceId !== null && cell.instanceId === selectedId}
            onSelect={() => onSelect(cell.instanceId === selectedId ? null : cell.instanceId)}
            onUnequip={onUnequip ? () => onUnequip(cell.role) : undefined}
            busy={busy}
          />
        ))}
      </div>

      <p className="text-2xs text-muted">
        Each slot shows both of its names — which one a piece answers to depends on the body wearing it.
        Three of the sixteen have no chimera form and their bonuses move elsewhere instead.
      </p>
    </div>
  );
}
