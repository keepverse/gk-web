import Phaser from "phaser";
import {
  worldBusEmit,
  worldBusOn,
  type WorldCameraPayload,
  type WorldInteractionPayload,
  type WorldModelPayload,
  type WorldResizedPayload
} from "../../EventBus";
import { snapshotTheme, type WorldTheme } from "../snapshotTheme";
import { WorldRegistry } from "../entities/WorldRegistry";
import { syncWorldSystem } from "../systems/syncWorldSystem";
import { worldCameraSystem } from "../systems/worldCameraSystem";
import { worldPickSystem } from "../systems/worldPickSystem";
import { worldOverlaySystem } from "../systems/worldOverlaySystem";
import { zoomTier, type ZoomTier } from "../zoomTier";
import { worldToCameraScreen, gameToCssPoint } from "../systems/worldPickCoords";

/**
 * Persistent world map while #/world is mounted.
 * Systems allow-list: Sync → Camera/LOD → Pick → Overlay (RT-08 analogue).
 * No WorldBootScene in v1 — framed placeholders live here (D10).
 */
export class WorldMapScene extends Phaser.Scene {
  private generation = 0;
  private theme: WorldTheme = snapshotTheme();
  private worldRegistry = new WorldRegistry();
  private lastApplied = 0;
  private model: unknown = null;
  private tier: ZoomTier = "map";
  private offs: Array<() => void> = [];
  private interaction: WorldInteractionPayload | null = null;
  private lens = "ownership";

  constructor() {
    super("WorldMapScene");
  }

  init(): void {
    // Restart-safe: generation from registry in init (not only create).
    this.generation = (this.game.registry.get("generation") as number) ?? 0;
    this.worldRegistry = new WorldRegistry();
    this.lastApplied = 0;
    this.model = null;
  }

  create(): void {
    this.generation = (this.game.registry.get("generation") as number) ?? this.generation;
    const bootTheme = this.game.registry.get("worldTheme") as WorldTheme | undefined;
    if (bootTheme) this.theme = bootTheme;

    this.cameras.main.setBackgroundColor(this.theme.soil);
    this.data.set("worldRegistry", this.worldRegistry);
    this.drawPlaceholderGrid();

    this.offs.push(
      worldBusOn("world:model", (raw) => {
        const p = raw as WorldModelPayload;
        if (p.generation !== this.generation) return;
        const applied = syncWorldSystem({
          scene: this,
          theme: this.theme,
          registry: this.worldRegistry,
          lastApplied: this.lastApplied,
          modelSeq: p.modelSeq,
          model: p.model,
          tier: this.tier
        });
        if (applied != null) {
          this.lastApplied = applied;
          this.model = p.model;
          worldOverlaySystem({
            scene: this,
            theme: this.theme,
            registry: this.worldRegistry,
            model: this.model,
            interaction: this.interaction,
            lens: this.lens,
            tier: this.tier
          });
        }
      })
    );

    this.offs.push(
      worldBusOn("world:camera", (raw) => {
        const p = raw as WorldCameraPayload;
        if (p.generation !== this.generation) return;
        worldCameraSystem.applyCommand(this, p);
        this.refreshLod();
      })
    );

    this.offs.push(
      worldBusOn("world:resized", (raw) => {
        const p = raw as WorldResizedPayload;
        if (p.generation !== this.generation) return;
        this.scale.resize(p.width, p.height);
      })
    );

    this.offs.push(
      worldBusOn("world:interaction", (raw) => {
        const p = raw as WorldInteractionPayload;
        if (p.generation !== this.generation) return;
        this.interaction = p;
        worldOverlaySystem({
          scene: this,
          theme: this.theme,
          registry: this.worldRegistry,
          model: this.model,
          interaction: this.interaction,
          lens: this.lens,
          tier: this.tier
        });
      })
    );

    this.offs.push(
      worldBusOn("world:lens", (raw) => {
        const p = raw as { generation?: number; lens?: string };
        if (p.generation !== this.generation) return;
        this.lens = p.lens ?? "ownership";
        if (import.meta.env.DEV) {
          console.info("[world-scene]", { event: "lens", generation: this.generation, lens: this.lens });
        }
        worldOverlaySystem({
          scene: this,
          theme: this.theme,
          registry: this.worldRegistry,
          model: this.model,
          interaction: this.interaction,
          lens: this.lens,
          tier: this.tier
        });
      })
    );

    worldPickSystem.wire(this, this.generation, () => this.interaction?.ignoreRects ?? []);
    worldCameraSystem.wirePointer(
      this,
      () => this.refreshLod(),
      () => this.interaction?.ignoreRects ?? []
    );

    worldBusEmit("world:ready", { generation: this.generation });

    // Observability — DEV/Playwright may read pin coordinates. Must not emit select (gaps D3).
    if (typeof window !== "undefined") {
      const allowProbe =
        import.meta.env.DEV ||
        (window as unknown as { __PLAYWRIGHT?: boolean }).__PLAYWRIGHT === true;
      if (allowProbe) {
        const w = window as unknown as {
          __fusionRpgWorldProbe?: {
            generation: number;
            pinScreen: (sectorId: string) => { x: number; y: number } | null;
            pinCount: () => number;
            centreOn?: (sectorId: string) => boolean;
          };
        };
        w.__fusionRpgWorldProbe = {
          generation: this.generation,
          pinCount: () => this.worldRegistry.sectorIds().length,
          pinScreen: (sectorId: string) => {
            const go = this.worldRegistry.getSector(sectorId) as Phaser.GameObjects.Container | undefined;
            if (!go) return null;
            // Match Phaser camera matrix (origin × zoom) — naive (world-scroll)*zoom misses when zoom ≠ 1.
            const cam = this.cameras.main;
            const game = worldToCameraScreen(go.x, go.y, cam.scrollX, cam.scrollY, cam.zoom, cam.width, cam.height);
            const canvas = this.game.canvas as HTMLCanvasElement;
            return gameToCssPoint(
              game.x,
              game.y,
              this.scale.width,
              this.scale.height,
              canvas.clientWidth,
              canvas.clientHeight
            );
          },
          /** Bring a pin into view before an honest mouse pick (Playwright only). */
          centreOn: (sectorId: string) => {
            const go = this.worldRegistry.getSector(sectorId) as Phaser.GameObjects.Container | undefined;
            if (!go) return false;
            this.cameras.main.centerOn(go.x, go.y);
            return true;
          }
        };
      }
    }
  }

  update(_time: number, delta: number): void {
    worldCameraSystem.tickEdgeScroll(this, delta);
  }

  shutdown(): void {
    for (const off of this.offs) off();
    this.offs = [];
    worldPickSystem.unwire(this);
    worldCameraSystem.unwire(this);
    this.worldRegistry.clear(this);
    worldOverlaySystem.clear(this);
    if (typeof window !== "undefined") {
      const w = window as unknown as {
        __fusionRpgWorldGen?: number;
        __fusionRpgWorldProbe?: unknown;
      };
      delete w.__fusionRpgWorldGen;
      delete w.__fusionRpgWorldProbe;
    }
  }

  private refreshLod(): void {
    const next = zoomTier(this.cameras.main.zoom);
    if (next === this.tier) return;
    this.tier = next;
    if (this.model != null) {
      syncWorldSystem({
        scene: this,
        theme: this.theme,
        registry: this.worldRegistry,
        lastApplied: this.lastApplied - 1,
        modelSeq: this.lastApplied,
        model: this.model,
        tier: this.tier,
        forceLodRefresh: true
      });
    }
  }

  private drawPlaceholderGrid(): void {
    const g = this.add.graphics();
    g.lineStyle(1, Phaser.Display.Color.HexStringToColor(this.theme.panel).color, 0.35);
    const step = 220;
    for (let x = -2000; x <= 4000; x += step) g.lineBetween(x, -2000, x, 4000);
    for (let y = -2000; y <= 4000; y += step) g.lineBetween(-2000, y, 4000, y);
    g.setDepth(-100);
    g.setName("world-backdrop-grid");
  }
}
