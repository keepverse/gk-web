import { createSurfaceBus } from "./createSurfaceBus";

/** Closed aptitude-preset-console bus (spec-aptitude-preset-console). */
export type PresetConsoleEvent =
  | "preset.close"
  | "preset.select"
  | "preset.new"
  | "preset.applyDraft"
  | "preset.activate"
  | "preset.save"
  | "preset.delete"
  | "preset.row.set"
  | "preset.name.set";

export function createPresetConsoleBus() {
  return createSurfaceBus<PresetConsoleEvent>();
}

export const PRESET_CONSOLE_EVENTS: readonly PresetConsoleEvent[] = [
  "preset.close",
  "preset.select",
  "preset.new",
  "preset.applyDraft",
  "preset.activate",
  "preset.save",
  "preset.delete",
  "preset.row.set",
  "preset.name.set"
] as const;
