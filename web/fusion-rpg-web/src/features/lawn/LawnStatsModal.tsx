import { useCallback, useRef, useState } from "react";
import { Badge, Button, KeyValue } from "@/ui";
import { listMowers, listOccupants, listPets, listTiles, type LawnViewModel } from "./lawnViewModel";

export function LawnStatsModal({
  open,
  model,
  canvasCount,
  onClose
}: {
  open: boolean;
  model: LawnViewModel;
  canvasCount: number;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ x: 16, y: 88 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    setPos({
      x: start.x + (e.clientX - start.px),
      y: start.y + (e.clientY - start.py)
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, []);

  if (!open) return null;

  const living = listOccupants(model);
  const plants = living.filter((o) => o.side === "plant").length;
  const zombies = living.filter((o) => o.side === "zombie").length;
  const econ = model.economy;

  return (
    <div
      role="dialog"
      aria-label="Lawn statistics"
      data-testid="lawn-stats-modal"
      className="band-hud fixed w-[min(22rem,calc(100vw-2rem))] rounded-md border border-border bg-panel p-3 shadow-panel"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="mb-2 flex cursor-grab items-center justify-between gap-2 active:cursor-grabbing"
        data-testid="lawn-stats-drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <h2 className="font-display text-lg text-text">Stats</h2>
        <Button size="sm" variant="ghost" onClick={onClose} data-testid="lawn-stats-close">
          Close
        </Button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        <Badge tone={model.phase === "InMatch" ? "ok" : "neutral"}>{model.phase}</Badge>
        <Badge tone="neutral">
          canvas {canvasCount} / living {living.length}
        </Badge>
      </div>
      <KeyValue
        items={[
          { label: "Revision", value: String(model.revision) },
          { label: "Plants", value: String(plants) },
          { label: "Zombies", value: String(zombies) },
          { label: "Mowers", value: String(listMowers(model).length) },
          { label: "Tiles", value: String(listTiles(model).length) },
          { label: "Pets", value: String(listPets(model).length) },
          { label: "Sun", value: econ?.sun != null ? String(econ.sun) : "—" },
          { label: "Money", value: econ?.money != null ? String(econ.money) : "—" },
          { label: "Points", value: econ?.points != null ? String(econ.points) : "—" },
          {
            label: "Wave",
            value:
              econ?.wave != null
                ? `${econ.wave}${econ.maxWave != null ? ` / ${econ.maxWave}` : ""}${econ.hugeWave ? " · huge" : ""}`
                : "—"
          },
          { label: "Level", value: model.levelName ?? "—" },
          { label: "Result", value: model.result ?? "—" },
          {
            label: "Last hit",
            value: model.lastHit
              ? `${model.lastHit.source ?? "hit"} dmg ${model.lastHit.damage ?? "?"} → ${model.lastHit.targetPtr ?? "?"}`
              : "—"
          },
          {
            label: "Last action",
            value: model.lastAction
              ? `${model.lastAction.kind} ${model.lastAction.summary}`
              : "—"
          },
          {
            label: "Invade",
            value: model.lastInvade
              ? `${model.lastInvade.typeName ?? model.lastInvade.ptr}`
              : "—"
          },
          { label: "Hand", value: String(model.hand.length) },
          { label: "Travel", value: String(model.travelBuffs.length) }
        ]}
      />
    </div>
  );
}
