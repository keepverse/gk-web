/** Shared keys and visual knobs for the scene-switch POC (not production content). */

export const POC_SCENE_KEYS = {
  world: "PocWorldScene",
  siege: "PocSiegeScene",
  lawn: "PocLawnScene"
} as const;

export type PocMode = keyof typeof POC_SCENE_KEYS;

export const POC_MODES: PocMode[] = ["world", "siege", "lawn"];

export function sceneKeyForMode(mode: PocMode): string {
  return POC_SCENE_KEYS[mode];
}

export function modeForSceneKey(key: string): PocMode | null {
  for (const mode of POC_MODES) {
    if (POC_SCENE_KEYS[mode] === key) return mode;
  }
  return null;
}

/** Registry key: `(ms: number, mode: PocMode) => void` called when a POC scene becomes active. */
export const POC_REGISTRY_ON_ACTIVE = "pocOnActive";

export type PocSceneVisual = {
  backgroundColor: string;
  label: string;
  markerColor: number;
};

export const POC_VISUALS: Record<PocMode, PocSceneVisual> = {
  world: { backgroundColor: "#1a3a2a", label: "WORLD", markerColor: 0x6bcb77 },
  siege: { backgroundColor: "#3a1a1a", label: "SIEGE", markerColor: 0xe74c3c },
  lawn: { backgroundColor: "#1a2a3a", label: "LAWN", markerColor: 0x5dade2 }
};

/** Marker count — plan bar uses ~20 markers on a fake board. */
export const POC_MARKER_COUNT = 20;
