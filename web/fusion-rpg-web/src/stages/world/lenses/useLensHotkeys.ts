import { useRef } from "react";
import { useWorldVerbs } from "@/stages/world/turn/worldVerbs";
import { isWorldMapChromeMuted } from "@/stages/world/mapChromeMute";
import { LENSES, type LensId } from "./lensCatalog";

/**
 * world-stage W96 — `1`-`6` registered through `worldVerbs.ts` (W78's own single owner), freed on
 * unmount. A ref keeps the registered handler stable while always calling this render's real
 * `onSelect` — `useWorldVerbs`'s own effect only re-registers when the key/id list changes, which
 * for this fixed, six-entry catalog is never, so a plain inline closure would go stale the first
 * time the caller's own `onSelect` identity changed across a render.
 *
 * GG-18 / gaps D8: no-op when a panel/dialog owns the stack.
 */
export function useLensHotkeys(onSelect: (id: LensId) => void): void {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useWorldVerbs(
    LENSES.map((lens) => ({
      key: lens.key,
      id: `world-lens-${lens.id}`,
      handler: () => {
        if (isWorldMapChromeMuted()) return;
        onSelectRef.current(lens.id);
      }
    }))
  );
}
