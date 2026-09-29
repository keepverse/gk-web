/**
 * View mirror: sector / lane / force id → live GameObject (RT-01 / DPLP registry).
 * Sync upserts by id; clear destroys every registered object.
 */
export class WorldRegistry {
  private readonly sectors = new Map<string, Phaser.GameObjects.GameObject>();
  private readonly lanes = new Map<string, Phaser.GameObjects.GameObject>();
  private readonly forces = new Map<string, Phaser.GameObjects.GameObject>();

  getSector(id: string): Phaser.GameObjects.GameObject | undefined {
    return this.sectors.get(id);
  }

  setSector(id: string, go: Phaser.GameObjects.GameObject): void {
    this.sectors.set(id, go);
  }

  deleteSector(id: string): void {
    this.sectors.delete(id);
  }

  sectorIds(): string[] {
    return [...this.sectors.keys()];
  }

  getLane(id: string): Phaser.GameObjects.GameObject | undefined {
    return this.lanes.get(id);
  }

  setLane(id: string, go: Phaser.GameObjects.GameObject): void {
    this.lanes.set(id, go);
  }

  deleteLane(id: string): void {
    this.lanes.delete(id);
  }

  laneIds(): string[] {
    return [...this.lanes.keys()];
  }

  getForce(id: string): Phaser.GameObjects.GameObject | undefined {
    return this.forces.get(id);
  }

  setForce(id: string, go: Phaser.GameObjects.GameObject): void {
    this.forces.set(id, go);
  }

  deleteForce(id: string): void {
    this.forces.delete(id);
  }

  forceIds(): string[] {
    return [...this.forces.keys()];
  }

  /** Destroy every registered GameObject and empty all maps. */
  clear(_scene: Phaser.Scene): void {
    for (const go of this.sectors.values()) go.destroy();
    for (const go of this.lanes.values()) go.destroy();
    for (const go of this.forces.values()) go.destroy();
    this.sectors.clear();
    this.lanes.clear();
    this.forces.clear();
  }
}
