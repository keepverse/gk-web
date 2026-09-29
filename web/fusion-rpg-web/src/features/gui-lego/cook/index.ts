/**
 * Pure cook/join helpers for Derived — moved from ui/actor/derived.
 * Absorb SSOT: one join path for fold + legacy test imports.
 */
export {
  COOK_PRIMARY_TAB_IDS,
  FORBIDDEN_PRIMARY_TAB_IDS,
  SHOW_UNCHANGED_KEY,
  COMPOSE_SENTENCE,
  UNIT_SENTENCE,
  RENDER_STATE_FICTION,
  SOURCES_TITLE,
  UNATTRIBUTED_LABEL,
  composeFiction,
  unitFiction,
  stateFiction,
  sourceFictionLabel,
  BUCKET_COLORS,
  BUCKET_LABELS,
  joinDerivedChannelId,
  expandDerivedFamily,
  registryCapFor,
  resolveDerivedRenderState,
  isUnchangedState,
  bucketContributions,
  formatChannelValue,
  toLiveMap,
  rowKind,
  donutPaths,
  type ExpandedDerivedChannel,
  type DerivedRenderState,
  type LiveChannelView,
  type DerivedRowModel,
  type ExpandDerivedVariants
} from "./derivedCook";

export { formatDerivedMagnitude } from "./formatDerivedMagnitude";
