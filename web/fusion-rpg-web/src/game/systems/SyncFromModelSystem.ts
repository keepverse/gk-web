import Phaser from "phaser";
import type { LawnMarker, LawnTile, LawnViewModel, Occupant } from "@/features/lawn/lawnViewModel";
import { listMowers, listOccupants, listPets, listTiles, normalizePtr } from "@/features/lawn/lawnViewModel";
import type { PtrEntityRegistry, PtrViewRecord } from "../entities/PtrEntityRegistry";
import { noteIconLoadFailure } from "@/features/lawn/lawnSyncGate";
import { lawnIconTextureKey, lawnIconUrl } from "../iconUrl";
import { getIconEpochMirror } from "../iconEpochMirror";
import { CELL_H, CELL_W, ORIGIN_X, ORIGIN_Y, cellToWorld } from "../gridMath";
import { requestSceneTexture, sceneArtState } from "./sceneArtState";
import { setHudDisplay } from "./ActorHudDisplay";

export { setHudDisplay } from "./ActorHudDisplay";

export { CELL_H, CELL_W, ORIGIN_X, ORIGIN_Y, cellToWorld };

export type SyncContext = {
  scene: Phaser.Scene;
  registry: PtrEntityRegistry;
  lastApplied: number;
  selectedPtr?: string;
  /** When set, only these living ptrs get sprites (hybrid overflow). */
  canvasPtrs?: Set<string>;
  /** Called after icon textures finish loading so sprites can refresh. */
  onIconsReady?: () => void;
};

const CHIP_COLOR: Record<string, number> = {
  hypno: 0x9b59b6,
  butter: 0xe8c547,
  freeze: 0x7ec8e3,
  cold: 0x4a90d9,
  poison: 0x6aaa4f,
  crash: 0xc0392b,
  wither: 0x8e6bb0,
  bond: 0xd4a574,
  blight: 0x5d8a45,
  rot: 0x4a6741
};

function fitIcon(img: Phaser.GameObjects.Image, maxW: number, maxH: number): void {
  const src = img.texture?.getSourceImage() as { width?: number; height?: number } | undefined;
  const tw = src?.width ?? maxW;
  const th = src?.height ?? maxH;
  if (!tw || !th) {
    img.setDisplaySize(maxW, maxH);
    return;
  }
  const s = Math.min(maxW / tw, maxH / th);
  img.setDisplaySize(tw * s, th * s);
}

function showPlaceholderChrome(go: Phaser.GameObjects.Container, show: boolean): void {
  const bg = go.getByName("occBg") as Phaser.GameObjects.Rectangle | null;
  const label = go.getByName("occLabel") as Phaser.GameObjects.Text | null;
  bg?.setVisible(show);
  label?.setVisible(show);
}

function ensureIcon(
  scene: Phaser.Scene,
  side: string,
  typeId: number,
  onReady?: () => void
): string {
  const epoch = getIconEpochMirror();
  const key = lawnIconTextureKey(side, typeId, epoch);
  const placeholder = scene.textures.exists("lawn-placeholder")
    ? "lawn-placeholder"
    : key;
  if (scene.textures.exists(key)) return key;
  // Returns the placeholder either way: a type icon always has chrome to fall back on, unlike a
  // catalog glyph whose slot is sized from data. The repaint is scheduled by the shared loader.
  requestSceneTexture(scene, key, lawnIconUrl(side, typeId, epoch), onReady);
  return placeholder;
}

/** One FILE_LOAD_ERROR listener for all in-flight type icons. */
export function wireLawnIconLoadErrors(scene: Phaser.Scene): () => void {
  const onErr = (file: { key?: string }) => {
    const st = sceneArtState(scene);
    if (!st._iconLoads) st._iconLoads = new Set();
    if (!st._iconFails) st._iconFails = new Set();
    const key = file?.key;
    if (!noteIconLoadFailure(st._iconLoads, st._iconFails, key)) return;
    if (key && scene.textures.exists(key)) scene.textures.remove(key);
  };
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onErr);
  return () => {
    scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onErr);
  };
}

/**
 * Drop cached type-icon textures so a new epoch can reload.
 *
 * Scoped to the `icon-` key prefix, which is what an epoch actually invalidates: a type icon's key
 * embeds the epoch, so a stale one is unusable, while a HUD element glyph's key does not and its
 * texture is epoch-independent. Clearing the shared memos wholesale would strand an in-flight glyph
 * — the request memo would be forgotten while the request was still running, and the next repaint
 * would ask the loader for a key it is already fetching.
 */
export function bustLawnIconTextures(scene: Phaser.Scene): void {
  const st = sceneArtState(scene);
  for (const memo of [st._iconLoads, st._iconFails]) {
    if (!memo) continue;
    for (const key of [...memo]) {
      if (key.startsWith("icon-")) memo.delete(key);
    }
  }
  for (const key of scene.textures.getTextureKeys()) {
    if (key.startsWith("icon-")) scene.textures.remove(key);
  }
}

function setSelectRing(
  scene: Phaser.Scene,
  go: Phaser.GameObjects.Container,
  selected: boolean
): void {
  const existing = go.getByName("selectRing") as Phaser.GameObjects.Arc | null;
  if (selected && !existing) {
    const ring = scene.add
      .circle(0, 0, 30, 0xe0b44b, 0)
      .setStrokeStyle(2, 0xe0b44b, 1)
      .setName("selectRing");
    go.add(ring);
  } else if (!selected && existing) {
    existing.destroy();
  }
}

function setStatusChips(
  scene: Phaser.Scene,
  go: Phaser.GameObjects.Container,
  chips: string[]
): void {
  const existing = go.getByName("chipRow") as Phaser.GameObjects.Container | null;
  existing?.destroy();
  const known = chips.filter((c) => CHIP_COLOR[c] != null);
  if (!known.length) return;
  const row = scene.add.container(-18, -26).setName("chipRow");
  known.forEach((c, i) => {
    row.add(scene.add.circle(i * 8, 0, 3, CHIP_COLOR[c], 1));
  });
  go.add(row);
}

/** Band B HUD + legacy chip suppression — shared by create and in-place occupant sync. */
export function syncOccupantBandB(
  scene: Phaser.Scene,
  go: Phaser.GameObjects.Container,
  occ: Pick<Occupant, "hud" | "statusChips">,
  onReady?: () => void
): void {
  setHudDisplay(scene, go, occ.hud, onReady);
  if (occ.hud) {
    setStatusChips(scene, go, []);
  } else {
    setStatusChips(scene, go, occ.statusChips);
  }
}

function setHpDisplay(
  scene: Phaser.Scene,
  go: Phaser.GameObjects.Container,
  occ: Occupant
): void {
  const label = occ.hp != null ? String(Math.round(occ.hp)) : "";
  let hpText = go.getByName("hpText") as Phaser.GameObjects.Text | null;
  if (!hpText) {
    hpText = scene.add
      .text(0, 28, label, { fontSize: "9px", color: "#f2ead8" })
      .setOrigin(0.5)
      .setName("hpText");
    go.add(hpText);
  } else {
    hpText.setText(label);
  }

  const ratio =
    occ.hp != null && occ.maxHp != null && occ.maxHp > 0
      ? Math.max(0, Math.min(1, occ.hp / occ.maxHp))
      : undefined;
  const barBg = go.getByName("hpBarBg") as Phaser.GameObjects.Rectangle | null;
  const barFg = go.getByName("hpBarFg") as Phaser.GameObjects.Rectangle | null;
  if (ratio == null) {
    barBg?.destroy();
    barFg?.destroy();
    return;
  }
  const w = 40;
  if (!barBg) {
    go.add(scene.add.rectangle(0, 26, w, 4, 0x3a3228, 1).setName("hpBarBg"));
  }
  if (!barFg) {
    go.add(
      scene.add
        .rectangle(-w / 2, 26, w * ratio, 4, 0x6aaa4f, 1)
        .setOrigin(0, 0.5)
        .setName("hpBarFg")
    );
  } else {
    barFg.width = w * ratio;
  }
}

function setIconTexture(
  scene: Phaser.Scene,
  go: Phaser.GameObjects.Container,
  side: string,
  typeId: number,
  onReady?: () => void
): void {
  const key = ensureIcon(scene, side, typeId, onReady);
  let img = go.getByName("occIcon") as Phaser.GameObjects.Image | null;
  if (!img) {
    if (!scene.textures.exists(key) && !scene.textures.exists("lawn-placeholder")) return;
    const tex = scene.textures.exists(key) ? key : "lawn-placeholder";
    img = scene.add.image(0, -6, tex).setName("occIcon");
    fitIcon(img, 40, 44);
    go.addAt(img, 1);
  }
  const real = scene.textures.exists(key) && key !== "lawn-placeholder";
  if (real) {
    img.setTexture(key);
    fitIcon(img, 40, 44);
    showPlaceholderChrome(go, false);
  } else {
    showPlaceholderChrome(go, true);
  }
}

function makeOccupantGo(
  scene: Phaser.Scene,
  occ: Occupant,
  selected: boolean,
  onReady?: () => void
): Phaser.GameObjects.Container {
  const fill = occ.side === "plant" ? 0x3d6b45 : 0x6e5a7a;
  const bg = scene.add
    .rectangle(0, 0, 52, 60, fill, 0.85)
    .setStrokeStyle(1, 0xe4d5b5, 0.5)
    .setName("occBg");
  const label = scene.add
    .text(0, 18, `#${occ.typeId}`, {
      fontSize: "10px",
      color: "#f2ead8"
    })
    .setOrigin(0.5)
    .setName("occLabel");
  const container = scene.add.container(0, 0, [bg, label]);
  container.setSize(52, 60);
  // Hit area includes Band B HUD above the body so HUD clicks open the dock (T12), not a dead zone.
  container.setInteractive(
    new Phaser.Geom.Rectangle(-26, -72, 52, 102),
    Phaser.Geom.Rectangle.Contains
  );
  setIconTexture(scene, container, occ.side, occ.typeId, onReady);
  setSelectRing(scene, container, selected);
  syncOccupantBandB(scene, container, occ, onReady);
  setHpDisplay(scene, container, occ);
  return container;
}

function makeTileGo(
  scene: Phaser.Scene,
  tile: LawnTile,
  selected: boolean
): Phaser.GameObjects.Container {
  const marker = scene.add
    .rectangle(0, 0, 22, 22, 0xc4a35a, 0.95)
    .setStrokeStyle(2, 0x8a7038, 1)
    .setAngle(45)
    .setName("tileMarker");
  const label = scene.add
    .text(0, 0, tile.typeName?.slice(0, 4) ?? `#${tile.typeId}`, {
      fontSize: "8px",
      color: "#1a140c"
    })
    .setOrigin(0.5)
    .setName("tileLabel");
  const container = scene.add.container(0, 0, [marker, label]);
  container.setSize(28, 28);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-14, -14, 28, 28),
    Phaser.Geom.Rectangle.Contains
  );
  setSelectRing(scene, container, selected);
  return container;
}

function makeMarkerGo(
  scene: Phaser.Scene,
  marker: LawnMarker,
  selected: boolean
): Phaser.GameObjects.Container {
  const fill = marker.kind === "mower" ? 0x8b3a3a : 0xd4a017;
  const shape =
    marker.kind === "mower"
      ? scene.add
          .rectangle(0, 0, 36, 18, fill, 0.95)
          .setStrokeStyle(2, 0x5a2424, 1)
          .setName("markerBody")
      : scene.add.circle(0, 0, 12, fill, 0.95).setStrokeStyle(2, 0x8a6a10, 1).setName("markerBody");
  const label = scene.add
    .text(0, 0, marker.kind === "mower" ? "M" : "P", {
      fontSize: "9px",
      color: "#f2ead8"
    })
    .setOrigin(0.5)
    .setName("markerLabel");
  const container = scene.add.container(0, 0, [shape, label]);
  container.setSize(36, 24);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-18, -12, 36, 24),
    Phaser.Geom.Rectangle.Contains
  );
  setSelectRing(scene, container, selected);
  return container;
}

function updateOccupantInPlace(
  scene: Phaser.Scene,
  rec: PtrViewRecord,
  occ: Occupant,
  selected: boolean,
  onReady?: () => void
): void {
  rec.row = occ.row;
  rec.col = occ.col;
  rec.chips = [...occ.statusChips];
  rec.instanceId = occ.instanceId;
  rec.selected = selected;
  const label = rec.go.getByName("occLabel") as Phaser.GameObjects.Text | null;
  label?.setText(`#${occ.typeId}`);
  setIconTexture(scene, rec.go, occ.side, occ.typeId, onReady);
  setSelectRing(scene, rec.go, selected);
  syncOccupantBandB(scene, rec.go, occ, onReady);
  setHpDisplay(scene, rec.go, occ);
}

function updateTileInPlace(
  rec: PtrViewRecord,
  tile: LawnTile,
  selected: boolean,
  scene: Phaser.Scene
): void {
  rec.row = tile.row;
  rec.col = tile.col;
  rec.typeId = tile.typeId;
  rec.selected = selected;
  const label = rec.go.getByName("tileLabel") as Phaser.GameObjects.Text | null;
  label?.setText(tile.typeName?.slice(0, 4) ?? `#${tile.typeId}`);
  setSelectRing(scene, rec.go, selected);
}

/**
 * Apply selection chrome without requiring a model revision bump (P0 fix).
 */
export function applySelectionChrome(ctx: SyncContext): void {
  for (const rec of ctx.registry.entries()) {
    const selected = ctx.selectedPtr
      ? normalizePtr(ctx.selectedPtr) === normalizePtr(rec.ptr)
      : false;
    if (rec.selected === selected) continue;
    rec.selected = selected;
    setSelectRing(ctx.scene, rec.go, selected);
  }
}

/**
 * Repaint every occupant's async art after the loader reports COMPLETE.
 *
 * Both Band B and the type icon are rebuilt here, and both come from the same `onReady` closure,
 * so there is exactly one repaint path per scene. Band B is here for the element glyph: the
 * identity row reserves its slot from the catalog's geometry but cannot draw a texture the loader
 * has not delivered yet, and this is the only thing that re-runs the draw afterwards. Omitting it
 * is what made the glyph appear only from the third board-stats onward (AUDIT-2).
 */
export function refreshOccupantArt(ctx: SyncContext, model: LawnViewModel): void {
  for (const occ of listOccupants(model)) {
    const rec = ctx.registry.get(occ.ptr);
    if (!rec || rec.side === "grid" || rec.side === "mower" || rec.side === "pet") continue;
    setIconTexture(ctx.scene, rec.go, occ.side, occ.typeId, ctx.onIconsReady);
    syncOccupantBandB(ctx.scene, rec.go, occ, ctx.onIconsReady);
  }
}

function destroyRec(rec: PtrViewRecord): void {
  rec.go.destroy(true);
}

/**
 * Apply LawnViewModel if revision is newer (RT-10). Registry is view mirror only.
 * Recreate GO only when side/typeId changes; otherwise update in place.
 * Phaser displays Occupant HP only — no combat math.
 */
export function syncFromModel(ctx: SyncContext, model: LawnViewModel): number {
  if (model.revision <= ctx.lastApplied) return ctx.lastApplied;

  const living = listOccupants(model).filter((o) => {
    if (!ctx.canvasPtrs) return true;
    return ctx.canvasPtrs.has(normalizePtr(o.ptr));
  });
  const tiles = listTiles(model);
  const mowers = listMowers(model);
  const pets = listPets(model);
  const want = new Set([
    ...living.map((o) => normalizePtr(o.ptr)),
    ...tiles.map((t) => normalizePtr(t.ptr)),
    ...mowers.map((t) => normalizePtr(t.ptr)),
    ...pets.map((t) => normalizePtr(t.ptr))
  ]);

  for (const key of ctx.registry.keys()) {
    if (!want.has(key)) {
      const prev = ctx.registry.delete(key);
      prev?.go.destroy(true);
    }
  }

  for (const occ of living) {
    const ptrKey = normalizePtr(occ.ptr);
    const selected = ctx.selectedPtr
      ? normalizePtr(ctx.selectedPtr) === ptrKey
      : false;
    const existing = ctx.registry.get(occ.ptr);
    const identityChanged =
      !existing ||
      existing.side !== occ.side ||
      existing.typeId !== occ.typeId;
    if (existing && !identityChanged) {
      updateOccupantInPlace(ctx.scene, existing, occ, selected, ctx.onIconsReady);
      ctx.registry.set(existing);
    } else {
      if (existing) destroyRec(existing);
      const go = makeOccupantGo(ctx.scene, occ, selected, ctx.onIconsReady);
      ctx.registry.set({
        ptr: occ.ptr,
        side: occ.side,
        typeId: occ.typeId,
        row: occ.row,
        col: occ.col,
        chips: [...occ.statusChips],
        selected,
        instanceId: occ.instanceId,
        go
      });
    }
  }

  for (const tile of tiles) {
    const ptrKey = normalizePtr(tile.ptr);
    const selected = ctx.selectedPtr
      ? normalizePtr(ctx.selectedPtr) === ptrKey
      : false;
    const existing = ctx.registry.get(tile.ptr);
    const identityChanged = !existing || existing.side !== "grid" || existing.typeId !== tile.typeId;
    if (existing && !identityChanged) {
      updateTileInPlace(existing, tile, selected, ctx.scene);
      ctx.registry.set(existing);
    } else {
      if (existing) destroyRec(existing);
      const go = makeTileGo(ctx.scene, tile, selected);
      ctx.registry.set({
        ptr: tile.ptr,
        side: "grid",
        typeId: tile.typeId,
        row: tile.row,
        col: tile.col,
        chips: [],
        selected,
        go
      });
    }
  }

  const syncMarker = (marker: LawnMarker) => {
    const ptrKey = normalizePtr(marker.ptr);
    const selected = ctx.selectedPtr
      ? normalizePtr(ctx.selectedPtr) === ptrKey
      : false;
    const existing = ctx.registry.get(marker.ptr);
    const identityChanged =
      !existing || existing.side !== marker.kind || existing.typeId !== marker.typeId;
    if (existing && !identityChanged) {
      existing.row = marker.row;
      existing.col = marker.col;
      existing.selected = selected;
      setSelectRing(ctx.scene, existing.go, selected);
      ctx.registry.set(existing);
    } else {
      if (existing) destroyRec(existing);
      const go = makeMarkerGo(ctx.scene, marker, selected);
      ctx.registry.set({
        ptr: marker.ptr,
        side: marker.kind,
        typeId: marker.typeId,
        row: marker.row,
        col: marker.col,
        chips: [],
        selected,
        go
      });
    }
  };

  for (const mower of mowers) syncMarker(mower);
  for (const pet of pets) syncMarker(pet);

  return model.revision;
}
