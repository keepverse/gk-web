import type Phaser from "phaser";
import type { Occupant } from "@/features/lawn/lawnViewModel";
import { EntityRegistry } from "./EntityRegistry";

/** View mirror only — never invent occupants (RT-01 / invariant 2). */
export type PtrViewRecord = {
  ptr: string;
  side: Occupant["side"] | "grid" | "mower" | "pet";
  typeId: number;
  row?: number;
  col?: number;
  chips: string[];
  selected: boolean;
  instanceId?: string;
  go: Phaser.GameObjects.Container;
};

/**
 * base-defense `board-render`: now a thin wrapper over the generic `EntityRegistry`, supplying the
 * lawn's own trim+uppercase key normalization and its own `go.destroy(true)` disposal — byte-
 * identical to this class's own pre-extraction behavior (same public API: `set` takes just the
 * record, deriving the key from `rec.ptr` at this wrapper's own call site, so no caller changes).
 */
export class PtrEntityRegistry {
  private readonly inner = new EntityRegistry<string, PtrViewRecord>({
    normalizeKey: (ptr) => ptr.trim().toUpperCase(),
    dispose: (rec) => rec.go.destroy(true)
  });

  get(ptr: string): PtrViewRecord | undefined {
    return this.inner.get(ptr);
  }

  entries(): IterableIterator<PtrViewRecord> {
    return this.inner.entries();
  }

  set(rec: PtrViewRecord): void {
    this.inner.set(rec.ptr, rec);
  }

  delete(ptr: string): PtrViewRecord | undefined {
    return this.inner.delete(ptr);
  }

  clear(): void {
    this.inner.clear();
  }

  keys(): string[] {
    return this.inner.keys();
  }
}
