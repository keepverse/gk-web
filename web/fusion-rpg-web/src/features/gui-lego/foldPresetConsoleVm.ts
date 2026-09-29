import type { AptitudePreset, AptitudePresetRow } from "@/lib/bus/aptitudePresets";
import { sumTargetPermille } from "@/features/aptitudes/evenPermille";
import { APTITUDE_PRESET_DONUT_PAINT } from "@/theme/chartPaint";

export type PresetGalleryItemVm = {
  presetId: string;
  name: string;
  kind: string;
  selected: boolean;
  active: boolean;
};

export type PresetEditorRowVm = {
  aptitudeId: string;
  displayName: string;
  targetPermille: number;
  minAbs: number | "";
  maxAbs: number | "";
  minPermille: number | "";
  maxPermille: number | "";
};

export type FoldPresetConsoleVmInput = {
  presets: AptitudePreset[];
  selectedPresetId: string | null;
  activePresetId: string | null;
  editorName: string;
  editorRows: AptitudePresetRow[];
  displayNames: Record<string, string>;
  budget: number;
  previewShares: Record<string, number>;
  previewLeftover: number;
  revision: number;
  mode: "unique" | "commander" | "species";
  /** Mode B — show price before Activate. */
  activatePriceLabel?: string | null;
  saving: boolean;
  activating: boolean;
};

export type PresetConsoleVm = {
  layout: { rootClass: string; mode: string };
  gallery: {
    items: PresetGalleryItemVm[];
    canNew: boolean;
  };
  editor: {
    name: string;
    rows: PresetEditorRowVm[];
    permilleSum: number;
    sumOk: boolean;
  };
  chart: {
    segments: { aptitudeId: string; displayName: string; permille: number; paint: string }[];
    revision: number;
    leftover: number;
    budget: number;
  };
  actions: {
    saveEnabled: boolean;
    applyEnabled: boolean;
    activateEnabled: boolean;
    deleteEnabled: boolean;
    activatePriceLabel: string | null;
    saving: boolean;
    activating: boolean;
  };
};

/** Recharts pie-slice fill — literal hex lives in `src/theme/chartPaint.ts` (guard's exempt directory). */
const DONUT_PAINT = APTITUDE_PRESET_DONUT_PAINT;

export function foldPresetConsoleVm(input: FoldPresetConsoleVmInput): PresetConsoleVm {
  const permilleSum = sumTargetPermille(input.editorRows);
  const sumOk = permilleSum === 1000;
  const hasSelection = Boolean(input.selectedPresetId);

  const items: PresetGalleryItemVm[] = input.presets.map((p) => ({
    presetId: p.presetId,
    name: p.name,
    kind: p.kind,
    selected: p.presetId === input.selectedPresetId,
    active: p.presetId === input.activePresetId
  }));

  const rows: PresetEditorRowVm[] = input.editorRows.map((r) => ({
    aptitudeId: r.aptitudeId,
    displayName: input.displayNames[r.aptitudeId] ?? r.aptitudeId,
    targetPermille: Math.trunc(Number(r.targetPermille) || 0),
    minAbs: r.minAbs == null ? "" : Number(r.minAbs),
    maxAbs: r.maxAbs == null ? "" : Number(r.maxAbs),
    minPermille: r.minPermille == null ? "" : Number(r.minPermille),
    maxPermille: r.maxPermille == null ? "" : Number(r.maxPermille)
  }));

  const segments = input.editorRows.map((r, i) => ({
    aptitudeId: r.aptitudeId,
    displayName: input.displayNames[r.aptitudeId] ?? r.aptitudeId,
    permille: Math.trunc(Number(r.targetPermille) || 0),
    paint: DONUT_PAINT[i % DONUT_PAINT.length]!
  }));

  return {
    layout: { rootClass: "aptitude-preset-console", mode: input.mode },
    gallery: { items, canNew: true },
    editor: {
      name: input.editorName,
      rows,
      permilleSum,
      sumOk
    },
    chart: {
      segments,
      revision: input.revision,
      leftover: input.previewLeftover,
      budget: input.budget
    },
    actions: {
      saveEnabled: sumOk && input.editorName.trim().length > 0 && !input.saving,
      applyEnabled: hasSelection && sumOk && !input.saving,
      activateEnabled: hasSelection && sumOk && !input.activating,
      deleteEnabled: hasSelection && !input.saving,
      activatePriceLabel: input.activatePriceLabel ?? null,
      saving: input.saving,
      activating: input.activating
    }
  };
}
