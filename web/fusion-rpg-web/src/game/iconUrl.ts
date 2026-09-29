import { getApiBaseMirror } from "./apiBaseMirror";
import { getIconEpochMirror } from "./iconEpochMirror";

/** Same composed PNG as TypeIcon, with epoch so Phaser shares the GUI cache. */
export function lawnIconUrl(side: string, typeId: number, epoch?: number): string {
  const r = epoch ?? getIconEpochMirror();
  return `${getApiBaseMirror()}/api/icons/${side}/${typeId}.png?r=${r}`;
}

export function lawnIconTextureKey(side: string, typeId: number, epoch?: number): string {
  const r = epoch ?? getIconEpochMirror();
  return `icon-${side}-${typeId}-e${r}`;
}
