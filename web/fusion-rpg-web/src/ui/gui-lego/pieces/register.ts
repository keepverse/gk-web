import { registerPiece } from "@/features/gui-lego/pieceRegistry";
import type { PieceFactory } from "@/features/gui-lego/types";
import { BADGE_SLOT_MAP, badgeFactories } from "./badges";
import { CHROME_SLOT_MAP, chromeFactories } from "./chrome";
import { CONDITION_SLOT_MAP, conditionFactories } from "./condition";
import { DOMAIN_SLOT_MAP, domainFactories } from "./domain";
import { LAYOUT_SLOT_MAP, layoutFactories } from "./layout";
import { LIFECYCLE_SLOT_MAP, lifecycleFactories } from "./lifecycle";
import { SHIELD_SLOT_MAP, shieldFactories } from "./shield";
import { APTITUDE_SLOT_MAP, aptitudeFactories } from "./aptitude";

let registered = false;

const ALL: {
  factories: Record<string, PieceFactory>;
  slots: Record<string, readonly string[]>;
}[] = [
  { factories: layoutFactories, slots: LAYOUT_SLOT_MAP },
  { factories: chromeFactories, slots: CHROME_SLOT_MAP },
  { factories: badgeFactories, slots: BADGE_SLOT_MAP },
  { factories: conditionFactories, slots: CONDITION_SLOT_MAP },
  { factories: domainFactories, slots: DOMAIN_SLOT_MAP },
  { factories: lifecycleFactories, slots: LIFECYCLE_SLOT_MAP },
  { factories: shieldFactories, slots: SHIELD_SLOT_MAP },
  { factories: aptitudeFactories, slots: APTITUDE_SLOT_MAP }
];

/** Register all Derived v1 piece factories into `pieceRegistry` (idempotent). */
export function registerDerivedPieces(): void {
  if (!registered) {
    for (const group of ALL) {
      for (const [pieceId, factory] of Object.entries(group.factories)) {
        registerPiece({
          pieceId,
          slots: group.slots[pieceId] ?? [],
          factory
        });
      }
    }
    registered = true;
    return;
  }
  // Aptitude factories grow during AS-3.x — re-bind so HMR / long-lived test runners pick up new pieceIds.
  for (const [pieceId, factory] of Object.entries(aptitudeFactories)) {
    registerPiece({
      pieceId,
      slots: APTITUDE_SLOT_MAP[pieceId] ?? [],
      factory
    });
  }
}

/** Test helper — allows re-register after `clearPieceRegistryForTests`. */
export function resetDerivedPiecesRegistrationFlagForTests(): void {
  registered = false;
}
