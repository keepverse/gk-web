import Phaser from "phaser";

export type CellBootConfig = {
  /** Next cell-stage scene key after preload. */
  nextScene: string;
};

/**
 * Generic cell-stage Boot — lawn / later siege+battle pass nextScene.
 * World stays Boot-less (D10).
 */
export class BootScene extends Phaser.Scene {
  private nextScene = "LawnWorldScene";

  constructor() {
    super({ key: "BootScene" });
  }

  init(data?: CellBootConfig): void {
    const fromData = data?.nextScene;
    const fromRegistry = this.game.registry.get("bootNextScene") as
      | string
      | undefined;
    this.nextScene = fromData || fromRegistry || "LawnWorldScene";
  }

  preload(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x5a8f62, 1);
    g.fillRoundedRect(0, 0, 40, 40, 4);
    g.generateTexture("lawn-placeholder", 40, 40);
    g.destroy();
  }

  create(): void {
    const generation = (this.game.registry.get("generation") as number) ?? 0;
    this.scene.start(this.nextScene, { generation });
  }
}
