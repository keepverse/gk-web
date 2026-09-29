import type { ThemePack, ThemeRef, ThemeResolved } from "./types";

import neutral from "./themes/neutral.json";
import sidePlant from "./themes/side-plant.json";
import sideZombie from "./themes/side-zombie.json";
import elementFire from "./themes/element-fire.json";
import elementIce from "./themes/element-ice.json";
import elementAir from "./themes/element-air.json";
import elementEarth from "./themes/element-earth.json";
import elementLight from "./themes/element-light.json";
import elementDark from "./themes/element-dark.json";
import elementOmni from "./themes/element-omni.json";
import statusDot from "./themes/status-category-dot.json";
import statusCc from "./themes/status-category-cc.json";
import statusContagion from "./themes/status-category-contagion.json";
import statusOmni from "./themes/status-category-omni.json";
import resourceHp from "./themes/resource-hp.json";
import resourceStamina from "./themes/resource-stamina.json";
import resourceHunger from "./themes/resource-hunger.json";
import resourceSpirit from "./themes/resource-spirit.json";
import resourceQi from "./themes/resource-qi.json";
import resourcePoise from "./themes/resource-poise.json";
import actionAttack from "./themes/action-category-attack.json";
import actionDefense from "./themes/action-category-defense.json";
import actionSupport from "./themes/action-category-support.json";
import actionMovement from "./themes/action-category-movement.json";
import actionStatus from "./themes/action-category-status.json";
import cookElements from "./themes/cook-tab-elements.json";
import cookStatus from "./themes/cook-tab-status.json";
import cookResources from "./themes/cook-tab-resources.json";
import cookOther from "./themes/cook-tab-other.json";
import bucketBase from "./themes/bucket-base.json";
import bucketAptitude from "./themes/bucket-aptitude.json";
import bucketEquip from "./themes/bucket-equip.json";
import bucketTree from "./themes/bucket-tree.json";
import bucketStatus from "./themes/bucket-status.json";
import bucketGrant from "./themes/bucket-grant.json";
import bucketOther from "./themes/bucket-other.json";
import bucketNeg from "./themes/bucket-neg.json";
import postureForce from "./themes/posture-force.json";
import postureFinesse from "./themes/posture-finesse.json";
import postureBastion from "./themes/posture-bastion.json";
import actorPenny from "./themes/actor-penny.json";
import actorDave from "./themes/actor-dave.json";
import sceneRiftPortal from "./themes/scene-rift-portal.json";
import sceneQuarantine from "./themes/scene-quarantine.json";
import wonderScopeSector from "./themes/wonder-scope-sector.json";
import wonderScopeEmpire from "./themes/wonder-scope-empire.json";
import wonderScopeWorld from "./themes/wonder-scope-world.json";
import wonderScopeMultiverse from "./themes/wonder-scope-multiverse.json";
import wonderRarityCommon from "./themes/wonder-rarity-common.json";
import wonderRarityUnique from "./themes/wonder-rarity-unique.json";

/**
 * FE copies of docs/design/gui-lego/themes/packs — design pack remains SSOT on conflict.
 * Sync note: re-copy packs when design JSON changes (manual until a sync script exists).
 * posture.* packs are aptitude-sheet chrome only — bucket.aptitude stays Derived-bucket.
 */
const PACKS: ThemePack[] = [
  neutral as ThemePack,
  sidePlant as ThemePack,
  sideZombie as ThemePack,
  elementFire as ThemePack,
  elementIce as ThemePack,
  elementAir as ThemePack,
  elementEarth as ThemePack,
  elementLight as ThemePack,
  elementDark as ThemePack,
  elementOmni as ThemePack,
  statusDot as ThemePack,
  statusCc as ThemePack,
  statusContagion as ThemePack,
  statusOmni as ThemePack,
  resourceHp as ThemePack,
  resourceStamina as ThemePack,
  resourceHunger as ThemePack,
  resourceSpirit as ThemePack,
  resourceQi as ThemePack,
  resourcePoise as ThemePack,
  actionAttack as ThemePack,
  actionDefense as ThemePack,
  actionSupport as ThemePack,
  actionMovement as ThemePack,
  actionStatus as ThemePack,
  cookElements as ThemePack,
  cookStatus as ThemePack,
  cookResources as ThemePack,
  cookOther as ThemePack,
  bucketBase as ThemePack,
  bucketAptitude as ThemePack,
  bucketEquip as ThemePack,
  bucketTree as ThemePack,
  bucketStatus as ThemePack,
  bucketGrant as ThemePack,
  bucketOther as ThemePack,
  bucketNeg as ThemePack,
  postureForce as ThemePack,
  postureFinesse as ThemePack,
  postureBastion as ThemePack,
  actorPenny as ThemePack,
  actorDave as ThemePack,
  sceneRiftPortal as ThemePack,
  sceneQuarantine as ThemePack,
  // empire-wonder-surfaces `wonder-display` §Design 2 (plan Task 4D.4) — FE copies of
  // docs/design/gui-lego/themes/packs/wonder-* (design SSOT; re-copy on change). Pack ids use
  // exact wire case (Sector/Empire/World/Multiverse, Common/Unique) so the fold maps wire to
  // paint with no case-folding. Built once here — the wonder-composer (4D.3) references by
  // contract and never creates pack files.
  wonderScopeSector as ThemePack,
  wonderScopeEmpire as ThemePack,
  wonderScopeWorld as ThemePack,
  wonderScopeMultiverse as ThemePack,
  wonderRarityCommon as ThemePack,
  wonderRarityUnique as ThemePack
];

const byId = new Map(PACKS.map((p) => [p.themeId, p]));
const NEUTRAL = byId.get("neutral") ?? (neutral as ThemePack);

export type ThemeRegistryHandle = {
  resolve: (ref: ThemeRef | undefined | null) => ThemeResolved;
  lookup: (ref: ThemeRef | undefined | null) => ThemePack;
};

export function themeIdFor(ref: ThemeRef): string {
  if (ref.kind === "neutral") return "neutral";
  return `${ref.kind}.${ref.id}`;
}

export function lookupThemePack(ref: ThemeRef | undefined | null): ThemePack {
  if (!ref) return NEUTRAL;
  return byId.get(themeIdFor(ref)) ?? NEUTRAL;
}

export function resolveTheme(ref: ThemeRef | undefined | null): ThemeResolved {
  const pack = lookupThemePack(ref);
  return {
    themeId: pack.themeId,
    css: { ...pack.css },
    paint: { ...pack.paint },
    vfx: { ...pack.vfx },
    glyphDefault: pack.glyphDefault ?? null
  };
}

/** Default injectable registry (D5) — fold may inject a test double. */
export const defaultThemeRegistry: ThemeRegistryHandle = {
  resolve: resolveTheme,
  lookup: lookupThemePack
};

export function listThemePacks(): readonly ThemePack[] {
  return PACKS;
}
