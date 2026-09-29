import type Phaser from "phaser";
import type { ActorHudSnapshot } from "@/features/lawn/lawnViewModel";
import { actorHudElementArtUrl } from "@/features/lawn/actorHudElementArt";
import { actorSurfaceCatalogNow } from "@/lib/actorSurfaceCatalog";
import { CELL_H } from "../gridMath";
import { requestSceneTexture } from "./sceneArtState";
import {
  STATUS_STRIP_MAX,
  TIER_STROKE,
  elementColorPhaser,
  resolveStatusHudToken,
  tierBadgeLetter
} from "./actorHudDisplayTokens";

/** Row offset fractions — mirror `actor-hud.v1.json` `rowOffset*` (structural; web does not load tuning file). */
const ROW_OFFSET_IDENTITY = 0.42;
const ROW_OFFSET_RESOURCES = 0.28;
const ROW_OFFSET_STATUSES = 0.14;

const SHIELD_BAR_WIDTH = 40;

function elementTextureKey(elementId: string): string {
  return `actor-hud-element-${elementId}`;
}

/**
 * The element glyph's texture key, or `undefined` while it is still in flight.
 *
 * `undefined` is NOT a "no glyph for this element" answer and must never be read as one: the
 * catalog already decided the slot exists (see the layout below), and the only reason nothing can
 * be drawn yet is that `scene.load` is asynchronous. The identity row reserves the slot from the
 * catalog's `hudPresentation` geometry, so the row is already correctly sized and centred with a
 * hole in it; `onReady` is what fills that hole when the texture lands.
 *
 * The two reasons a slot is legitimately empty — the element has no `hudGlyph` (`omni`, and any
 * `presentationOnly` row), and `hudPresentation` is absent so the catalog gives the slot zero
 * width — are both decided above this call, from data, and neither starts a load.
 */
function ensureElementTexture(
  scene: Phaser.Scene,
  elementId: string,
  onReady?: () => void
): string | undefined {
  const url = actorHudElementArtUrl(elementId);
  if (!url) return undefined;
  // The pure HUD layout tests use a deliberately minimal scene stub. In a real Phaser scene both
  // services are always present; without them there is no texture surface to load or draw onto.
  if (!scene.textures || !scene.load) return undefined;
  const key = elementTextureKey(elementId);
  if (scene.textures.exists(key)) return key;
  requestSceneTexture(scene, key, url, onReady);
  return undefined;
}


export function layoutHudRows(cellH: number = CELL_H): {
  identityY: number;
  resourcesY: number;
  statusesY: number;
} {
  return {
    identityY: -cellH * ROW_OFFSET_IDENTITY,
    resourcesY: -cellH * ROW_OFFSET_RESOURCES,
    statusesY: -cellH * ROW_OFFSET_STATUSES
  };
}

export function shieldSegmentWidths(
  stacks: { hp: number; max: number }[],
  barWidth: number
): number[] {
  const totalMax = stacks.reduce((sum, seg) => sum + Math.max(0, seg.max), 0);
  if (totalMax <= 0) return stacks.map(() => 0);
  return stacks.map((seg) => {
    const segmentShare = seg.max / totalMax;
    const fillRatio = seg.max > 0 ? Math.max(0, Math.min(1, seg.hp / seg.max)) : 0;
    const width = barWidth * segmentShare * fillRatio;
    return seg.hp > 0 ? Math.max(width, 1) : 0;
  });
}

export function shouldShowHud(hud: ActorHudSnapshot | undefined): hud is ActorHudSnapshot {
  return hud != null;
}

type ShieldResource = NonNullable<NonNullable<ActorHudSnapshot["resources"]>["shield"]>;

/** Unity parity — hide shield row when aggregate hp is depleted. */
export function shouldShowShield(shield: ShieldResource | undefined): shield is ShieldResource {
  return shield != null && shield.max > 0 && shield.hp > 0 && shield.stacks.length > 0;
}

/**
 * Paint Band B onto an occupant's container. Idempotent: the previous stack is destroyed and
 * rebuilt from `hud` every call, so the load-complete repaint is just another call.
 *
 * `onReady` is the scene's art-ready closure. A draw site must not wait for a texture — the model
 * apply that produced this snapshot is synchronous, and a HUD that only appears once the next
 * board-stats lands is a HUD that shows nothing at all on a quiet board.
 */
export function setHudDisplay(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  hud: ActorHudSnapshot | undefined,
  onReady?: () => void
): void {
  const existing = container.getByName("hudStack") as Phaser.GameObjects.Container | null;
  if (!shouldShowHud(hud)) {
    existing?.destroy();
    return;
  }

  existing?.destroy();

  const rows = layoutHudRows();
  const stack = scene.add.container(0, 0).setName("hudStack");
  // HUD is paint-only — picks resolve via the parent occupant hit area (PickSystem / T12).
  stack.setScrollFactor(1);

  const identityRow = scene.add.container(0, rows.identityY).setName("hudIdentity");
  const stroke = TIER_STROKE[hud.identity.tier] ?? TIER_STROKE.normal;
  const tierFrame = scene.add.rectangle(-14, 0, 14, 14, 0x000000, 0.35).setStrokeStyle(2, stroke, 1);
  identityRow.add(tierFrame);
  const letter = tierBadgeLetter(hud.identity.tier);
  if (letter) {
    identityRow.add(
      scene.add.text(-14, 0, letter, { fontSize: "8px", color: "#f2ead8" }).setOrigin(0.5)
    );
  }

  const presentation = actorSurfaceCatalogNow().hudPresentation;
  const elementIds = [hud.elements?.primary, hud.elements?.secondary].filter((id): id is string => Boolean(id));
  const primarySize = presentation ? presentation.identityElementPrimaryPixels / 2 : 0;
  const secondarySize = presentation ? presentation.identityElementSecondaryPixels / 2 : 0;
  const gap = presentation ? presentation.identityElementGapPixels / 2 : 2;
  const widths = [14, hud.identity.levelBand != null ? 10 : 0, 8, ...elementIds.map((_, index) => index === 0 ? primarySize : secondarySize)].filter((width) => width > 0);
  let identityX = -(widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap) / 2;
  tierFrame.x = identityX + 7;
  identityX += 14 + gap;
  if (hud.identity.levelBand != null) {
    identityRow.add(
      scene.add
        .text(identityX, 0, String(hud.identity.levelBand), {
          fontSize: "7px",
          color: "#f2ead8",
          backgroundColor: "#2a231b"
        })
        .setOrigin(0.5)
    );
    identityX += 10 + gap;
  }

  const roleChar = hud.identity.role === "specimen" ? "S" : "V";
  identityRow.add(
    scene.add
      .text(identityX, 0, roleChar, { fontSize: "7px", color: "#c0b8a8" })
      .setOrigin(0.5)
  );
  identityX += 8 + gap;
  elementIds.forEach((id, index) => {
    const size = index === 0 ? primarySize : secondarySize;
    // `size` is the slot's reserved width from the catalog, so it is known before the texture is.
    // The texture may not be: skip the IMAGE, never the slot. The `return` here deliberately
    // leaves `identityX` un-advanced — it is the last loop in the row, and the row's centring was
    // computed from `widths` above, which already reserved this element's space.
    if (size <= 0) return;
    const texture = ensureElementTexture(scene, id, onReady);
    if (!texture) return;
    identityRow.add(scene.add.image(identityX + size / 2, 0, texture).setDisplaySize(size, size).setName(`hudElement${index}`));
    identityX += size + gap;
  });
  stack.add(identityRow);

  const shield = hud.resources?.shield;
  if (shouldShowShield(shield)) {
    const shieldRow = scene.add.container(0, rows.resourcesY);
    shieldRow.add(
      scene.add
        .rectangle(0, 0, SHIELD_BAR_WIDTH, 4, 0x2a231b, 1)
        .setName("hudShield")
    );

    const widths = shieldSegmentWidths(shield.stacks, SHIELD_BAR_WIDTH);
    let segX = -SHIELD_BAR_WIDTH / 2;
    shield.stacks.forEach((seg, i) => {
      const w = widths[i] ?? 0;
      if (w <= 0) return;
      const color = elementColorPhaser(seg.element);
      shieldRow.add(
        scene.add.rectangle(segX + w / 2, 0, w, 4, color, 1).setOrigin(0.5)
      );
      segX += w;
    });
    stack.add(shieldRow);
  }

  const visibleStatuses = hud.statuses.slice(0, STATUS_STRIP_MAX);
  if (visibleStatuses.length > 0 || hud.overflow.statusCount > 0) {
    const statusRow = scene.add.container(0, rows.statusesY);
    const slotCount = visibleStatuses.length + (hud.overflow.statusCount > 0 ? 1 : 0);
    let sx = -((slotCount - 1) * 12) / 2;
    visibleStatuses.forEach((status, i) => {
      const token = resolveStatusHudToken(status.id);
      statusRow.add(
        scene.add
          .text(sx, 0, token.hudToken, {
            fontSize: "7px",
            color: token.color,
            backgroundColor: "#3a3228"
          })
          .setOrigin(0.5)
          .setName(`hudStatus${i}`)
      );
      sx += 12;
    });
    if (hud.overflow.statusCount > 0) {
      statusRow.add(
        scene.add
          .text(sx, 0, `+${hud.overflow.statusCount}`, {
            fontSize: "6px",
            color: "#f2ead8",
            backgroundColor: "#3a3228"
          })
          .setOrigin(0.5)
          .setName("hudOverflow")
      );
    }
    stack.add(statusRow);
  }

  container.add(stack);
}
