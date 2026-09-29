import Phaser from "phaser";
import type { LawnViewMode } from "@/features/lawn/lawnViewMode";
import type { LawnViewModel } from "@/features/lawn/lawnViewModel";
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  listOccupants,
  normalizePtr
} from "@/features/lawn/lawnViewModel";
import { parseLawnViewMode } from "@/features/lawn/lawnViewMode";
import {
  PHASER_OCCUPANT_BUDGET,
  pickPhaserOccupants
} from "@/features/lawn/pickPhaserOccupants";
import {
  forceSyncLastApplied,
  shouldSyncLawnSprites
} from "@/features/lawn/lawnSyncGate";
import { PtrEntityRegistry } from "../entities/PtrEntityRegistry";
import { FxPool } from "../fx/FxPool";
import {
  lawnBusEmit,
  lawnBusOn,
  type LawnInteractionPayload,
  type LawnModelPayload,
  type LawnViewModePayload
} from "../EventBus";
import {
  CELL_H,
  CELL_W,
  LAWN_CAMERA_MARGIN,
  LAWN_MIN_CAMERA_ZOOM,
  ORIGIN_X,
  ORIGIN_Y
} from "../gridMath";
import { bindCamera, type CameraBridge } from "../camera/bindCamera";
import { createLawnBoardLayers, paintLawnTerrainGraphics } from "../board/lawnTerrainPaint";
import type { BoardLayers } from "../board/BoardLayers";
import { makeGridSpec, type GridPos } from "../board/GridSpec";
import {
  initialFocus,
  wireKeyboardNav,
  type KeySource
} from "../board/keyboardNav";
import { isLawnKeyboardMuted } from "../focusGate";
import { layoutGrid } from "../systems/LayoutGridSystem";
import { wirePickSystem } from "../systems/PickSystem";
import { tickStatusFx, clearStatusFxRings } from "../systems/StatusFxSystem";
import {
  applySelectionChrome,
  bustLawnIconTextures,
  refreshOccupantArt,
  syncFromModel,
  wireLawnIconLoadErrors,
  type SyncContext
} from "../systems/SyncFromModelSystem";

export type LawnWorldInit = {
  generation: number;
};

declare global {
  interface Window {
    /** Playwright e2e — probe named HUD children on the Phaser lawn canvas. */
    __fusionRpgHasHudChild?: (ptr: string, name: string) => boolean;
    /**
     * Playwright e2e — which ON-CANVAS occupants currently carry an element in their snapshot.
     *
     * A read-only view of the same fold the canvas draws from, for one purpose: an element glyph
     * can only be asserted for a ptr whose snapshot actually HAS an element. A real board emits
     * `elements: null` on the first events after a spawn, so a spec that expects a glyph from the
     * first event is reading an absence as a presence. This makes the window start where a glyph is
     * expected instead of guessing.
     */
    __fusionRpgLawnHudElements?: () => { ptr: string; element: string | null }[];
  }
}

function findNamedDescendant(
  go: Phaser.GameObjects.GameObject,
  name: string
): Phaser.GameObjects.GameObject | null {
  if (go.name === name) return go;
  const container = go as Phaser.GameObjects.Container;
  if (!container.list?.length) return null;
  for (const child of container.list) {
    const hit = findNamedDescendant(child as Phaser.GameObjects.GameObject, name);
    if (hit) return hit;
  }
  return null;
}

/**
 * Persistent lawn world while #/lawn mounted.
 * Systems allow-list: Sync → Layout → StatusFx → Pick (RT-08).
 * Board-stats refresh is the React host, not this scene.
 */
export class LawnWorldScene extends Phaser.Scene {
  private generation = 0;
  private ptrRegistry = new PtrEntityRegistry();
  private fx!: FxPool;
  private lastApplied = 0;
  private model: LawnViewModel | null = null;
  private selectedPtr?: string;
  private viewMode: LawnViewMode = "split";
  private lastViewMode: LawnViewMode = "split";
  private lastCanvasKey = "";
  private unsubs: Array<() => void> = [];
  private pickUnsub?: () => void;
  private keyboardUnsub?: () => void;
  private keyboardFocus: GridPos = initialFocus();
  private cameraBridge?: CameraBridge;
  private boardLayers?: BoardLayers;
  private gridGfx?: Phaser.GameObjects.Graphics;
  private gridRows = 0;
  private gridCols = 0;
  private phaseText?: Phaser.GameObjects.Text;
  private ghost?: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: "LawnWorldScene" });
  }

  init(data: LawnWorldInit): void {
    this.generation =
      data?.generation ??
      (this.game?.registry?.get("generation") as number | undefined) ??
      0;
    // Restart hygiene: registry must not stick on constructor-only state.
    this.ptrRegistry = new PtrEntityRegistry();
    this.lastApplied = 0;
    this.model = null;
    this.selectedPtr = undefined;
  }

  create(): void {
    this.fx = new FxPool(this);
    this.cameras.main.setBackgroundColor(0x16120e);
    this.boardLayers = createLawnBoardLayers(this);
    this.paintTerrain(DEFAULT_ROWS, DEFAULT_COLS);
    this.phaseText = this.add
      .text(12, 8, "Idle", {
        fontSize: "14px",
        color: "#a89880"
      })
      .setDepth(1000);

    this.pickUnsub = wirePickSystem(
      this,
      this.ptrRegistry,
      this.generation,
      () => ({
        rows: this.model?.rows ?? DEFAULT_ROWS,
        cols: this.model?.cols ?? DEFAULT_COLS
      })
    );

    // GG-18: gate then nav — mute when React panel owns input.
    const kb = this.input.keyboard;
    if (kb) {
      const keys: KeySource = {
        on: (event, handler) => {
          kb.on(event, handler);
        },
        off: (event, handler) => {
          kb.off(event, handler);
        }
      };
      this.keyboardUnsub = wireKeyboardNav({
        keys,
        isEnabled: () => !isLawnKeyboardMuted(),
        getSpec: () =>
          makeGridSpec(
            this.gridRows || DEFAULT_ROWS,
            this.gridCols || DEFAULT_COLS
          ),
        getFocus: () => this.keyboardFocus,
        onFocusChange: (pos) => {
          this.keyboardFocus = pos;
        },
        onConfirm: (pos) => {
          this.emitKeyboardSelect(pos);
        }
      });
    }

    this.unsubs.push(
      lawnBusOn("lawn:model", (raw) => {
        const p = raw as LawnModelPayload;
        if (p.generation !== this.generation) return;
        this.model = p.model as LawnViewModel;
        this.applyModel();
      })
    );

    this.unsubs.push(
      lawnBusOn("lawn:interaction", (raw) => {
        const p = raw as LawnInteractionPayload;
        if (p.generation !== this.generation) return;
        this.selectedPtr = p.ptr;
        if (p.mode === "SpawnTargeting" && p.row != null && p.col != null) {
          this.showGhost(p.row, p.col);
        } else {
          this.clearGhost();
        }
        this.applyModel();
      })
    );

    this.unsubs.push(
      lawnBusOn("lawn:viewMode", (raw) => {
        const p = raw as LawnViewModePayload;
        if (p.generation !== this.generation) return;
        this.viewMode = parseLawnViewMode(p.viewMode);
        this.applyModel();
      })
    );

    this.unsubs.push(wireLawnIconLoadErrors(this));
    this.unsubs.push(
      lawnBusOn("lawn:iconEpoch", (raw) => {
        const p = raw as { generation?: number };
        if (p.generation !== this.generation) return;
        bustLawnIconTextures(this);
        this.lastApplied = 0;
        this.applyModel();
      })
    );

    this.cameraBridge = bindCamera({
      scale: this.scale,
      camera: this.cameras.main,
      getModel: () => ({
        rows: this.gridRows || DEFAULT_ROWS,
        cols: this.gridCols || DEFAULT_COLS
      }),
      geometry: { cellWidth: CELL_W, cellHeight: CELL_H, originX: ORIGIN_X, originY: ORIGIN_Y },
      margin: LAWN_CAMERA_MARGIN,
      minZoom: LAWN_MIN_CAMERA_ZOOM
    });
    this.cameraBridge.refresh();
    if (typeof window !== "undefined") {
      window.__fusionRpgHasHudChild = (ptr, name) => {
        const rec = this.ptrRegistry.get(ptr);
        if (!rec) return false;
        return findNamedDescendant(rec.go, name) != null;
      };
      window.__fusionRpgLawnHudElements = () => {
        if (!this.model) return [];
        return listOccupants(this.model)
          .filter((occ) => this.ptrRegistry.get(occ.ptr))
          .map((occ) => ({
            ptr: normalizePtr(occ.ptr),
            element: occ.hud?.elements?.primary ?? null
          }));
      };
    }
    lawnBusEmit("lawn:ready", { generation: this.generation });
  }

  private syncCtx(canvasPtrs?: Set<string>): SyncContext {
    return {
      scene: this,
      registry: this.ptrRegistry,
      lastApplied: this.lastApplied,
      selectedPtr: this.selectedPtr,
      canvasPtrs,
      onIconsReady: () => {
        if (!this.model) return;
        refreshOccupantArt(this.syncCtx(canvasPtrs), this.model);
      }
    };
  }

  private paintTerrain(rows: number, cols: number): void {
    if (this.gridGfx && this.gridRows === rows && this.gridCols === cols) return;
    if (!this.boardLayers) {
      this.boardLayers = createLawnBoardLayers(this);
    }
    this.gridGfx = paintLawnTerrainGraphics(
      this,
      this.boardLayers,
      rows,
      cols,
      this.gridGfx
    );
    this.gridRows = rows;
    this.gridCols = cols;
    this.keyboardFocus = {
      row: Math.min(this.keyboardFocus.row, rows - 1),
      col: Math.min(this.keyboardFocus.col, cols - 1)
    };
  }

  /**
   * Confirm current keyboard focus — GG-21 tile dock: Enter opens the cell occupancy dock
   * (`kind: "tile"`), never topmost-only inspect. Direct GO hits still select occupants.
   */
  private emitKeyboardSelect(pos: GridPos): void {
    lawnBusEmit("lawn:select", {
      generation: this.generation,
      kind: "tile",
      row: pos.row,
      col: pos.col
    });
  }

  private applyModel(): void {
    if (!this.model) return;
    this.paintTerrain(
      Math.max(DEFAULT_ROWS, this.model.rows),
      Math.max(DEFAULT_COLS, this.model.cols)
    );
    this.phaseText?.setText(`${this.model.phase} · rev ${this.model.revision}`);

    const pick = pickPhaserOccupants(
      listOccupants(this.model),
      PHASER_OCCUPANT_BUDGET,
      this.selectedPtr
    );
    const canvasPtrs = new Set(pick.onCanvas.map((o) => normalizePtr(o.ptr)));
    const canvasKey = [...canvasPtrs].sort().join(",");
    const canvasChanged = canvasKey !== this.lastCanvasKey;
    const modeChanged = this.viewMode !== this.lastViewMode;
    const sync = shouldSyncLawnSprites({
      revision: this.model.revision,
      lastApplied: this.lastApplied,
      canvasKey,
      lastCanvasKey: this.lastCanvasKey
    });

    if (sync) {
      const ctx = this.syncCtx(canvasPtrs);
      ctx.lastApplied = forceSyncLastApplied(
        this.model.revision,
        ctx.lastApplied,
        canvasChanged
      );
      this.lastApplied = syncFromModel(ctx, this.model);
    }

    applySelectionChrome(this.syncCtx(canvasPtrs));
    if (sync || modeChanged) {
      layoutGrid(this.ptrRegistry, this.model, this.viewMode);
    }
    this.lastCanvasKey = canvasKey;
    this.lastViewMode = this.viewMode;
    if (sync || modeChanged) this.cameraBridge?.refresh();
  }

  private showGhost(row: number, col: number): void {
    this.clearGhost();
    const x = ORIGIN_X + col * CELL_W + CELL_W / 2;
    const y = ORIGIN_Y + row * CELL_H + CELL_H / 2;
    this.ghost = this.add
      .rectangle(x, y, 48, 56, 0xe0b44b, 0.25)
      .setStrokeStyle(2, 0xe0b44b, 0.8)
      .setDepth(500);
  }

  private clearGhost(): void {
    this.ghost?.destroy();
    this.ghost = undefined;
  }

  update(_time: number, delta: number): void {
    tickStatusFx(this.ptrRegistry, this.fx, delta);
  }

  shutdown(): void {
    if (typeof window !== "undefined") {
      delete window.__fusionRpgHasHudChild;
      delete window.__fusionRpgLawnHudElements;
    }
    this.cameraBridge?.unbind();
    this.pickUnsub?.();
    this.pickUnsub = undefined;
    this.keyboardUnsub?.();
    this.keyboardUnsub = undefined;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    try {
      this.tweens.killAll();
    } catch {
      /* */
    }
    if (this.fx) {
      clearStatusFxRings(this.fx);
      this.fx.drain();
    }
    this.ptrRegistry.clear();
    this.clearGhost();
  }
}
