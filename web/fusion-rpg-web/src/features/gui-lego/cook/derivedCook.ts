/**
 * Pure cook/join for ActorSheet → Derived. No React.
 * Visual SSOT: docs/design/gui-lego/surfaces/derived-console.html
 */
import type {
  DerivedExpandKind,
  DerivedFamilyCatalogRow,
  DerivedSurfaceFamily,
  ElementCatalogRow
} from "@/lib/bus/actorSurface";
import {
  contributionFictionLabel,
  type ActorContributionDto,
  type DerivedChannelDto
} from "@/lib/bus/aura";
import { formatDerivedMagnitude } from "./formatDerivedMagnitude";
export {
  COMPOSE_SENTENCE,
  UNIT_SENTENCE,
  RENDER_STATE_FICTION,
  SOURCES_TITLE,
  UNATTRIBUTED_LABEL,
  composeFiction,
  unitFiction,
  stateFiction,
  sourceFictionLabel
} from "./derivedPlayerCopy";

/** Primary Derived rail — cook surface tabs only. Never sheetGroups (offense/pools/…). */
export const COOK_PRIMARY_TAB_IDS = ["elements", "status", "resources", "other"] as const;

/** Forbidden as primary Derived tablist labels/ids (sheetGroup IA). */
export const FORBIDDEN_PRIMARY_TAB_IDS = [
  "offense",
  "pools",
  "progression",
  "defense",
  "utility",
  "skill"
] as const;

export const SHOW_UNCHANGED_KEY = "derived.showUnchanged";

export type ExpandedDerivedChannel = {
  channelId: string;
  element: ElementCatalogRow | null;
  variantLabel: string;
};

export type DerivedRenderState =
  | "active"
  | "default"
  | "capped"
  | "stub"
  | "no-producer"
  | "unregistered";

export type LiveChannelView = {
  channelId: string;
  value: number;
  displayName: string;
  reading: string;
  composeKind: string;
  contributions: ActorContributionDto[];
  present: boolean;
  unitClass?: string;
  defaultValue?: number;
  /** Wire cap — null means uncapped; undefined means lean/unknown (do not invent). */
  cap?: number | null;
  renderState?: DerivedRenderState;
};

export type DerivedRowModel = {
  family: DerivedSurfaceFamily;
  categoryId: string;
  categoryLabel: string;
  entry: ExpandedDerivedChannel;
  live: LiveChannelView | undefined;
  state: DerivedRenderState;
  displayName: string;
};

/** Optional cook/catalog variant lists — expand never invents L2b / action-category ids. */
export type ExpandDerivedVariants = {
  statusCategoryVariants?: { id: string; displayName?: string }[];
  actionCategoryVariants?: { id: string; displayName?: string }[];
};

const STUB_CHANNELS = new Set(["progression.power", "progression.realm"]);
/** Expand-join ids the registry rejects — FE parity only when wire renderState absent (D2). */
const UNREGISTERED_CHANNELS = new Set(["turn.moveSpeed"]);

export const BUCKET_COLORS: Record<string, string> = {
  base: "var(--faint)",
  aptitude: "var(--info)",
  equip: "var(--sun)",
  tree: "var(--lawn-hot)",
  status: "var(--el-fire)",
  grant: "var(--el-light)",
  other: "var(--muted)",
  neg: "var(--bad)"
};

export const BUCKET_LABELS: Record<string, string> = {
  base: "Base / progression",
  aptitude: "Aptitude",
  equip: "Equip",
  tree: "Tree",
  status: "Status",
  grant: "Grant",
  other: "Other",
  neg: "Penalties"
};

export function joinDerivedChannelId(
  family: string,
  expand: DerivedExpandKind,
  variantId: string | null
): string {
  if (expand === "none" || !variantId) return family;
  return `${family}.${variantId}`;
}

export function expandDerivedFamily(
  family: DerivedFamilyCatalogRow | DerivedSurfaceFamily,
  elements: ElementCatalogRow[],
  resources: { id: string }[] = [],
  statuses: { id: string; displayName?: string }[] = [],
  variants: ExpandDerivedVariants = {}
): ExpandedDerivedChannel[] {
  const expand = family.expand as DerivedExpandKind;
  switch (expand) {
    case "element":
      return [...elements]
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((element) => ({
          channelId: `${family.family}.${element.id}`,
          element,
          variantLabel: element.displayName
        }));
    case "status-id":
      return [
        { channelId: `${family.family}.omni`, element: null, variantLabel: "Omni" },
        ...[...statuses]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((s) => ({
            channelId: `${family.family}.${s.id}`,
            element: null,
            variantLabel: s.displayName ?? s.id
          }))
      ];
    case "status-category": {
      const cats = variants.statusCategoryVariants ?? [];
      return cats.map((v) => ({
        channelId: `${family.family}.${v.id}`,
        element: null,
        variantLabel: v.displayName ?? v.id
      }));
    }
    case "resource":
      return resources.map((r) => ({
        channelId: `${family.family}.${r.id}`,
        element: null,
        variantLabel: r.id
      }));
    case "action-category": {
      const acts = variants.actionCategoryVariants ?? [];
      return acts.map((v) => ({
        channelId: `${family.family}.${v.id}`,
        element: null,
        variantLabel: v.displayName ?? v.id
      }));
    }
    case "none":
    default:
      return [{ channelId: family.family, element: null, variantLabel: family.displayName }];
  }
}

/**
 * Cap from wire only (DC-3). Pass `wireCap` from sheet `channel.cap` (including null for omni).
 * No FE KNOWN_CAPS / literal 0.95 / immune=1 invent.
 */
export function registryCapFor(
  _channelId: string,
  _familyCapRef: string | null,
  wireCap?: number | null
): number | null {
  if (wireCap !== undefined) return wireCap;
  return null;
}

export function resolveDerivedRenderState(
  channelId: string,
  live: LiveChannelView | undefined,
  familyCapRef: string | null
): DerivedRenderState {
  // D2: prefer wire renderState when present (parity recompute only when absent).
  if (live?.renderState) return live.renderState;
  if (STUB_CHANNELS.has(channelId)) return "stub";
  if (UNREGISTERED_CHANNELS.has(channelId)) return "unregistered";
  if (!live?.present) {
    // Absent from snapshot: registered-but-silent → no-producer (never collapse to default).
    return "no-producer";
  }
  const cap = registryCapFor(channelId, familyCapRef, live.cap);
  if (cap != null && live.value >= cap - 1e-9) return "capped";
  const defaultValue = live.defaultValue ?? 0;
  const touched = live.contributions.some((c) => c.value !== 0);
  if (!touched && Math.abs(live.value - defaultValue) < 1e-9) return "default";
  if (!touched) return "default";
  return "active";
}

/** D4: Show-unchanged hides `default` only — never `no-producer`. */
export function isUnchangedState(state: DerivedRenderState): boolean {
  return state === "default";
}

export function bucketContributions(contributions: ActorContributionDto[]): {
  key: string;
  label: string;
  value: number;
}[] {
  const buckets: Record<string, number> = {
    base: 0,
    aptitude: 0,
    equip: 0,
    tree: 0,
    status: 0,
    grant: 0,
    other: 0,
    neg: 0
  };
  for (const c of contributions) {
    if (c.value < 0) {
      buckets.neg += Math.abs(c.value);
      continue;
    }
    if (c.sourceId === "rpg.progression" || c.sourceId.startsWith("primary:")) buckets.base += c.value;
    else if (c.sourceId.startsWith("aptitude.")) buckets.aptitude += c.value;
    else if (c.sourceId.startsWith("equip:")) buckets.equip += c.value;
    else if (c.sourceId.startsWith("tree.")) buckets.tree += c.value;
    else if (c.sourceId.startsWith("status:")) buckets.status += c.value;
    else if (c.sourceId.startsWith("grant:")) buckets.grant += c.value;
    else buckets.other += c.value;
  }
  return Object.entries(buckets)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, label: BUCKET_LABELS[key] ?? key, value }));
}

/** Thin alias — channel totals use formatDerivedMagnitude role "total". */
export function formatChannelValue(value: number, unitClass: string): string {
  return formatDerivedMagnitude(value, unitClass, { role: "total" }).valueText;
}

export function toLiveMap(
  sheetChannels:
    | {
        channelId: string;
        value: number;
        displayName?: string;
        reading?: string;
        composeKind?: string;
        contributions: ActorContributionDto[];
        unitClass?: string;
        defaultValue?: number;
        cap?: number | null;
        renderState?: string;
      }[]
    | undefined,
  lean: DerivedChannelDto[] | undefined
): Map<string, LiveChannelView> {
  const map = new Map<string, LiveChannelView>();
  if (sheetChannels?.length) {
    for (const ch of sheetChannels) {
      map.set(ch.channelId, {
        channelId: ch.channelId,
        value: ch.value,
        displayName: ch.displayName ?? ch.channelId,
        reading: ch.reading ?? "",
        composeKind: ch.composeKind ?? "",
        contributions: ch.contributions,
        present: true,
        unitClass: ch.unitClass,
        defaultValue: ch.defaultValue,
        cap: ch.cap,
        renderState: ch.renderState as DerivedRenderState | undefined
      });
    }
    return map;
  }
  // Lean /derived without sheet projection — no invent of cap/renderState (UniqueCreature Pending honesty).
  for (const ch of lean ?? []) {
    map.set(ch.channelId, {
      channelId: ch.channelId,
      value: ch.value,
      displayName: ch.channelId,
      reading: "",
      composeKind: "",
      contributions: ch.contributions.map((c) => ({
        sourceId: c.sourceId,
        label: contributionFictionLabel(c.sourceId),
        op: c.op,
        value: c.value
      })),
      present: true
    });
  }
  return map;
}

export function rowKind(state: DerivedRenderState): string {
  if (state === "capped") return "capped";
  if (state === "stub") return "stub";
  if (state === "no-producer") return "no-producer";
  return "plain";
}

export function donutPaths(
  entries: { key: string; value: number }[]
): { key: string; d: string; fill: string }[] {
  const totalPos = entries.filter((e) => e.key !== "neg").reduce((a, e) => a + e.value, 0) || 1;
  let angle = -90;
  const r = 34;
  const c = 40;
  const toRad = (d: number) => (d * Math.PI) / 180;
  return entries
    .filter((e) => e.key !== "neg")
    .map((e) => {
      const frac = e.value / totalPos;
      const sweep = frac * 360;
      const start = angle;
      angle += sweep;
      const x1 = c + r * Math.cos(toRad(start));
      const y1 = c + r * Math.sin(toRad(start));
      const x2 = c + r * Math.cos(toRad(start + sweep));
      const y2 = c + r * Math.sin(toRad(start + sweep));
      const large = sweep > 180 ? 1 : 0;
      const d =
        sweep >= 359.9
          ? `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.01} ${c - r} Z`
          : `M ${c} ${c} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return { key: e.key, d, fill: BUCKET_COLORS[e.key] ?? BUCKET_COLORS.other! };
    });
}
