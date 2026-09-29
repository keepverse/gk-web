/**
 * Actor-surface catalog — the React-FREE half.
 *
 * Split out of `lib/bus/actorSurface.ts` so the Phaser lawn plane can read the catalog without
 * dragging React, the query client and the REST helper in with it. `src/game/scenes/importGuard`
 * bans `@/lib/bus` (and React) from `src/game/**`, and the guard is right: the engine plane has no
 * business pulling a view layer in to read one presentation table. Everything here is the static
 * tuning JSON plus a cache on `window` — no hooks, no fetch.
 *
 * `lib/bus/actorSurface.ts` re-exports all of it, so every existing consumer and every public type
 * keeps importing from the same place; this module is the *source*, not a second API.
 */

import aptitudeCatalogJson from "../../../../data/tuning/aptitude-catalog.v1.json";
import derivedCatalogJson from "../../../../data/tuning/derived-stat-catalog.v2.json";
import elementCatalogJson from "../../../../data/tuning/element-catalog.v2.json";
import resourceCatalogJson from "../../../../data/tuning/resource-catalog.v1.json";
import statusCatalogJson from "../../../../data/tuning/status-catalog.v1.json";
import actorSheetJson from "../../../../data/tuning/actor-sheet.v1.json";

export type ActorSheetTabKind =
  | "condition"
  | "aptitudes"
  | "derived"
  | "shield"
  | "status"
  | "elements"
  | "kit"
  | "paths";

export type DerivedExpandKind =
  | "none"
  | "element"
  | "status-category"
  | "status-id"
  | "resource"
  | "action-category";

export type ActorSurfaceTab = {
  kind: ActorSheetTabKind;
  label: string;
  order: number;
  hidden: boolean;
  /** Optional lucide key for rail icons (CatalogIcon). */
  icon?: string | null;
};

export type AptitudeCatalogRow = {
  id: string;
  posture: string;
  ordinal: number;
  displayName: string;
  role: string;
  reading: string;
  /** Lucide / CatalogIcon key — optional so a missing icon never crashes the tile. */
  icon?: string | null;
};

export type DerivedFamilyCatalogRow = {
  family: string;
  expand: DerivedExpandKind;
  compose: string;
  unitClass: string;
  displayName: string;
  reading: string;
  icon: string;
  gauge: string;
  sheetGroup: string;
  capRef: string | null;
};

export type ResourceCatalogRow = {
  id: string;
  class: string;
  exhaustion: boolean;
  actionCost: boolean;
  labels: { plant: string; zombie: string };
  icon: string;
  color: string;
  meterKind: string;
};

export type ElementCatalogRow = {
  id: string;
  displayName: string;
  ordinal: number;
  color: string;
  presentationOnly: boolean;
  hudGlyph?: string | null;
};

export type StatusCatalogRow = {
  id: string;
  displayName: string;
  reading: string;
  hudToken: string;
  color: string;
  /** L2b categories from status-catalog — replaces fold statusId→L2b maps. */
  categories?: string[];
  icon?: string | null;
};

export type KitRoleCatalogRow = {
  roleId: string;
  labels: { humanoid: string; plant: string };
};

export type ActorSurfaceCatalog = {
  tabs: ActorSurfaceTab[];
  defaultOpen: ActorSheetTabKind;
  aptitudes: AptitudeCatalogRow[];
  families: DerivedFamilyCatalogRow[];
  resources: ResourceCatalogRow[];
  elements: ElementCatalogRow[];
  statuses: StatusCatalogRow[];
  kitRoles: KitRoleCatalogRow[];
  hudPresentation?: { identityElementPrimaryPixels: number; identityElementSecondaryPixels: number; identityElementGapPixels: number };
  versionStamp: string;
};

type LocaleMap = Record<string, string>;

function localeEn(value: string | LocaleMap): string {
  if (typeof value === "string") return value;
  return value.en ?? Object.values(value)[0] ?? "";
}

const derivedFamilies: DerivedFamilyCatalogRow[] = derivedCatalogJson.entries.map((entry) => ({
  family: entry.family,
  expand: entry.expand as DerivedExpandKind,
  compose: entry.compose,
  unitClass: entry.unitClass,
  displayName: localeEn(entry.displayName as string | LocaleMap),
  reading: localeEn(entry.reading as string | LocaleMap),
  icon: entry.icon,
  gauge: entry.gauge,
  sheetGroup: entry.sheetGroup,
  capRef: entry.capRef ?? null
}));

const fixtureCatalog: ActorSurfaceCatalog = {
  tabs: actorSheetJson.tabs as ActorSurfaceTab[],
  defaultOpen: actorSheetJson.defaultOpen as ActorSheetTabKind,
  aptitudes: aptitudeCatalogJson.entries,
  families: derivedFamilies,
  resources: resourceCatalogJson.entries,
  elements: elementCatalogJson.entries,
  statuses: statusCatalogJson.entries,
  kitRoles: actorSheetJson.kitRoles,
  versionStamp: [
    actorSheetJson.version,
    aptitudeCatalogJson.version,
    derivedCatalogJson.version,
    resourceCatalogJson.version,
    elementCatalogJson.version,
    statusCatalogJson.version
  ].join(".")
};

declare global {
  interface Window {
    /** ActorSheet and Band B share this catalog identity lookup. */
    __fusionRpgActorSurface?: ActorSurfaceCatalog;
  }
}

if (typeof window !== "undefined" && !window.__fusionRpgActorSurface) {
  window.__fusionRpgActorSurface = fixtureCatalog;
}

export function actorSurfaceFixture(): ActorSurfaceCatalog {
  return fixtureCatalog;
}

export type DerivedSurfaceVariant = {
  id: string;
  displayName: string;
  ordinal: number;
  presentationOnly: boolean;
};

export type DerivedSurfaceFamily = {
  family: string;
  displayName: string;
  reading: string;
  compose: string;
  unitClass: string;
  icon: string;
  gauge: string;
  capRef: string | null;
  expand: DerivedExpandKind;
  channelPattern: string;
};

export type DerivedSurfaceCategory = {
  id: string;
  displayName: string;
  order: number;
  families: DerivedSurfaceFamily[];
};

export type DerivedSurfaceTab = {
  id: string;
  displayName: string;
  order: number;
  expand: DerivedExpandKind;
  variants: DerivedSurfaceVariant[];
  actionCategoryVariants?: DerivedSurfaceVariant[] | null;
  categories: DerivedSurfaceCategory[];
};

export type DerivedSurfaceDto = {
  lang: string;
  side: string;
  schemaVersion: number;
  versionStamp: string;
  tabs: DerivedSurfaceTab[];
};

/** Offline / missing-endpoint: cook-shaped surface mirroring DerivedSurfaceCook tabs. */
export function derivedSurfaceFromFixture(
  surface: ActorSurfaceCatalog = fixtureCatalog,
  side = "plant"
): DerivedSurfaceDto {
  const raw = derivedCatalogJson as {
    tabs: { id: string; displayName: string | LocaleMap; order: number; expand: string }[];
    sheetGroups: { id: string; tab: string; displayName: string | LocaleMap; order: number }[];
    statusCategoryVariants: {
      id: string;
      displayName: string | LocaleMap;
      ordinal: number;
      presentationOnly?: boolean;
    }[];
    actionCategoryVariants: { id: string; displayName: string | LocaleMap; ordinal: number }[];
  };

  const byGroup = new Map<string, DerivedFamilyCatalogRow[]>();
  for (const family of surface.families) {
    const list = byGroup.get(family.sheetGroup) ?? [];
    list.push(family);
    byGroup.set(family.sheetGroup, list);
  }

  const toFamily = (f: DerivedFamilyCatalogRow): DerivedSurfaceFamily => ({
    family: f.family,
    displayName: f.displayName,
    reading: f.reading,
    compose: f.compose,
    unitClass: f.unitClass,
    icon: f.icon,
    gauge: f.gauge,
    capRef: f.capRef,
    expand: f.expand,
    channelPattern: f.expand === "none" ? "{family}" : "{family}.{variant}"
  });

  const tabs: DerivedSurfaceTab[] = [...raw.tabs]
    .sort((a, b) => a.order - b.order)
    .map((tab) => {
      const categories: DerivedSurfaceCategory[] = raw.sheetGroups
        .filter((g) => g.tab === tab.id)
        .sort((a, b) => a.order - b.order)
        .map((g) => ({
          id: g.id,
          displayName: localeEn(g.displayName),
          order: g.order,
          families: (byGroup.get(g.id) ?? []).map(toFamily)
        }));

      let variants: DerivedSurfaceVariant[] = [];
      let actionCategoryVariants: DerivedSurfaceVariant[] | null = null;

      if (tab.id === "elements") {
        variants = surface.elements
          .slice()
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((e) => ({
            id: e.id,
            displayName: e.displayName,
            ordinal: e.ordinal,
            presentationOnly: e.presentationOnly
          }));
      } else if (tab.id === "status") {
        variants = raw.statusCategoryVariants
          .slice()
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((v) => ({
            id: v.id,
            displayName: localeEn(v.displayName),
            ordinal: v.ordinal,
            presentationOnly: v.id === "omni"
          }));
      } else if (tab.id === "resources") {
        variants = surface.resources.map((r, i) => ({
          id: r.id,
          displayName: side === "zombie" ? r.labels.zombie : r.labels.plant,
          ordinal: i,
          presentationOnly: false
        }));
      } else if (tab.id === "other") {
        // D3: Shared from cook Variants — fixture mirrors DerivedSurfaceCook.
        variants = [
          {
            id: "shared",
            displayName: "Shared",
            ordinal: 0,
            presentationOnly: false
          }
        ];
        actionCategoryVariants = raw.actionCategoryVariants
          .slice()
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((v) => ({
            id: v.id,
            displayName: localeEn(v.displayName),
            ordinal: v.ordinal,
            presentationOnly: false
          }));
      }

      return {
        id: tab.id,
        displayName: localeEn(tab.displayName),
        order: tab.order,
        expand: tab.expand as DerivedExpandKind,
        variants,
        actionCategoryVariants,
        categories
      };
    });

  return {
    lang: "en",
    side,
    schemaVersion: 2,
    versionStamp: surface.versionStamp,
    tabs
  };
}

/**
 * The catalog as it stands right now, from the `window` cache the React layer keeps fresh.
 * The lawn plane's only door into the catalog: engine code has no hooks and no fetch, so this is
 * a read of a value someone else already fetched.
 */
export function actorSurfaceCatalogNow(): ActorSurfaceCatalog {
  return window.__fusionRpgActorSurface ?? fixtureCatalog;
}
