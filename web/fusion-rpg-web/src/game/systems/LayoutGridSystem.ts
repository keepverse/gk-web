import type { LawnViewMode } from "@/features/lawn/lawnViewMode";
import type { LawnViewModel } from "@/features/lawn/lawnViewModel";
import type { PtrEntityRegistry, PtrViewRecord } from "../entities/PtrEntityRegistry";
import { cellToWorld } from "../gridMath";
import { stackDrawPlan, stackOffset, type StackSide } from "../stackLayout";

const ORPHAN_Y = 24;

function cellSideKey(row: number, col: number, side: string): string {
  return `${row},${col}:${side}`;
}

function ensureBoundPip(rec: PtrViewRecord): void {
  const existing = rec.go.getByName("boundPip");
  if (!rec.instanceId) {
    existing?.destroy(true);
    return;
  }
  if (existing) {
    if ("setVisible" in existing) (existing as Phaser.GameObjects.Arc).setVisible(true);
    return;
  }
  const scene = rec.go.scene;
  if (!scene) return;
  // Small identity pip — Bound unique under stack (spec-cell-stack).
  const pip = scene.add
    .circle(14, -22, 4, 0xe8b040, 1)
    .setStrokeStyle(1, 0x2a231b, 1)
    .setName("boundPip");
  rec.go.add(pip);
}

function ensureOverflowPip(anchor: PtrViewRecord, overflowK: number): void {
  const existing = anchor.go.getByName("stackOverflow") as Phaser.GameObjects.Text | null;
  if (overflowK <= 0) {
    existing?.destroy(true);
    return;
  }
  if (existing) {
    existing.setText(`+${overflowK}`);
    existing.setVisible(true);
    return;
  }
  const scene = anchor.go.scene;
  if (!scene) return;
  const label = scene.add
    .text(16, 18, `+${overflowK}`, {
      fontSize: "9px",
      color: "#f2ead8",
      backgroundColor: "#2a231b"
    })
    .setOrigin(0.5)
    .setName("stackOverflow");
  // Keep setText path hot so callers/tests can assert overflow updates.
  label.setText(`+${overflowK}`);
  anchor.go.add(label);
}

/** Layout living sprites onto the grid; orphans along a top strip. */
export function layoutGrid(
  registry: PtrEntityRegistry,
  _model: LawnViewModel,
  viewMode: LawnViewMode = "split"
): void {
  // Stack offsets apply in stack mode and whenever a cell has 2+ living (monitor without click).
  const forceStackMode = viewMode === "stack";
  const buckets = new Map<string, PtrViewRecord[]>();
  const rest: PtrViewRecord[] = [];

  for (const rec of registry.entries()) {
    const onCell = rec.row != null && rec.col != null && rec.col >= 0;
    if (onCell && (rec.side === "plant" || rec.side === "zombie")) {
      const key = cellSideKey(rec.row!, rec.col!, rec.side);
      const list = buckets.get(key);
      if (list) list.push(rec);
      else buckets.set(key, [rec]);
    } else {
      rest.push(rec);
    }
  }

  for (const recs of buckets.values()) {
    const side = recs[0]!.side as StackSide;
    const n = recs.length;
    const stack = forceStackMode || n > 1;
    const plan = stackDrawPlan(n);

    recs.forEach((rec, i) => {
      const { x, y } = cellToWorld(rec.row!, rec.col!);
      const visible = i < plan.drawCount;
      rec.go.setVisible(visible);
      if (!visible) {
        ensureOverflowPip(rec, 0);
        return;
      }
      if (stack) {
        const o = stackOffset(side, i, plan.drawCount);
        rec.go.setPosition(x + o.dx, y + o.dy);
        rec.go.setDepth(o.depth);
        rec.go.setScale(0.72);
      } else {
        rec.go.setPosition(x, y);
        rec.go.setDepth(5 + i);
        rec.go.setScale(1);
      }
      ensureBoundPip(rec);
      // Only the last drawn sprite carries +K.
      ensureOverflowPip(rec, i === plan.drawCount - 1 ? plan.overflowK : 0);
    });
  }

  let orphanIndex = 0;
  for (const rec of rest) {
    rec.go.setVisible(true);
    ensureOverflowPip(rec, 0);
    if (rec.row != null && rec.col != null && rec.col >= 0) {
      const { x, y } = cellToWorld(rec.row, rec.col);
      if (rec.side === "grid") {
        rec.go.setPosition(x - 22, y + 18);
        rec.go.setDepth(1);
      } else if (rec.side === "mower") {
        rec.go.setPosition(x - 36, y);
        rec.go.setDepth(2);
      } else if (rec.side === "pet") {
        rec.go.setPosition(x + 22, y - 16);
        rec.go.setDepth(3);
      } else {
        rec.go.setPosition(x, y);
        rec.go.setDepth(5);
      }
      rec.go.setScale(1);
    } else {
      const x = 40 + orphanIndex * 56;
      rec.go.setPosition(x, ORPHAN_Y);
      rec.go.setDepth(4);
      rec.go.setScale(forceStackMode ? 0.72 : 1);
      orphanIndex++;
    }
  }
}
