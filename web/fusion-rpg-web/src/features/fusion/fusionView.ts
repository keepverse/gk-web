/** Pure fusion-lab display logic (spec-creature-fusion.md F9) — vitest-covered. */

export type FusionCostDto = {
  souls: number;
  shardMaterialId: string;
  shardCount: number;
  essenceMaterialId: string;
  essenceCount: number;
};

// WAVE F2.5: one atom a sacrifice actually rolled, offered for inheritance — the server has
// already filtered out anything it would refuse (already-owned output species, below-floor rarity).
export type PickableAtom = {
  sourceInstanceId: string;
  sourceSpeciesId: string;
  atomId: string;
  costSouls: number;
};

export type SelectedPick = { sourceInstanceId: string; atomId: string };

/** Toggle one pick in/out of a selection, capped at `slotCap` — mirrors the server's own
 * `slotsByRarity` ceiling (`RecipeUnlocked`'s `picks.exceeds-slots` refusal) so the UI can never
 * assemble a request the server would refuse for being over-cap. */
export function togglePick(selected: SelectedPick[], pick: SelectedPick, slotCap: number): SelectedPick[] {
  const same = (p: SelectedPick) => p.sourceInstanceId === pick.sourceInstanceId && p.atomId === pick.atomId;
  if (selected.some(same)) return selected.filter((p) => !same(p));
  return selected.length < slotCap ? [...selected, pick] : selected;
}

/** Sum of each selected pick's own souls cost, looked up by (sourceInstanceId, atomId) against the
 * server-priced list — never re-derived client-side (F2.3's own per-source-rarity table). */
export function picksSoulsCost(selected: SelectedPick[], pickable: PickableAtom[]): number {
  return selected.reduce((sum, p) => {
    const found = pickable.find((a) => a.sourceInstanceId === p.sourceInstanceId && a.atomId === p.atomId);
    return sum + (found?.costSouls ?? 0);
  }, 0);
}

/** The recipe's base cost with the selected picks' own souls added on top — souls only (an
 * inherited pick never prices shards/essence). */
export function costWithPicks(
  cost: FusionCostDto,
  selected: SelectedPick[],
  pickable: PickableAtom[]
): FusionCostDto {
  return { ...cost, souls: cost.souls + picksSoulsCost(selected, pickable) };
}

export type MaterialShelf = { materialId: string; qty: number }[];

export type HaveNeedLine = { label: string; have: number; need: number; enough: boolean };

/** Cost rows with have/need against the shelf + Souls balance; affordable = every line enough. */
export function haveNeed(cost: FusionCostDto, shelf: MaterialShelf, soulsBalance: number): {
  lines: HaveNeedLine[];
  affordable: boolean;
} {
  const qty = (id: string) => shelf.find((m) => m.materialId === id)?.qty ?? 0;
  const lines: HaveNeedLine[] = [
    { label: "Souls", have: soulsBalance, need: cost.souls, enough: soulsBalance >= cost.souls },
    {
      label: cost.shardMaterialId,
      have: qty(cost.shardMaterialId),
      need: cost.shardCount,
      enough: qty(cost.shardMaterialId) >= cost.shardCount
    },
    {
      label: cost.essenceMaterialId,
      have: qty(cost.essenceMaterialId),
      need: cost.essenceCount,
      enough: qty(cost.essenceMaterialId) >= cost.essenceCount
    }
  ];
  return { lines, affordable: lines.every((l) => l.enough) };
}

/** Star pips: filled to `star`, hollow to the cap. */
export function starPips(star: number, cap: number): string {
  const filled = Math.max(0, Math.min(star, cap));
  return "★".repeat(filled) + "☆".repeat(Math.max(0, cap - filled));
}

export const STAR_CAPS: Record<string, number> = {
  common: 3,
  rare: 4,
  epic: 5,
  legendary: 5
};

/** Recipe browser label: undiscovered entries stay silhouetted ("???"), hints show ingredients. */
export function recipeLabel(item: {
  discovered: boolean;
  resultSpeciesId?: string | null;
  inputs?: string[] | null;
}, speciesName: (id: string) => string): { title: string; subtitle: string } {
  if (item.discovered && item.resultSpeciesId) {
    return {
      title: speciesName(item.resultSpeciesId),
      subtitle: (item.inputs ?? []).map(speciesName).join(" + ")
    };
  }
  return {
    title: "???",
    subtitle: item.inputs ? item.inputs.map(speciesName).join(" + ") + " …?" : "Undiscovered"
  };
}
