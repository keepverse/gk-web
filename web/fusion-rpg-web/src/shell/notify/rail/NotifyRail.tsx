import type { RailItem as RailItemData } from "./railStore";
import { RailItem } from "./RailItem";

export type NotifyRailProps = {
  items: readonly RailItemData[];
  onOpen: (id: string) => void;
  onDismiss: (id: string) => void;
  onUndoDismiss: (id: string) => void;
};

/**
 * world-stage W87 — band 1, right-anchored above `world-outliner`, scrolling inside its own bounded
 * shell (GG-61) so the stage behind it never moves. Declares no `z-index` of its own —
 * `shell/bandGuard.test.ts` already fails a surface that does.
 */
export function NotifyRail({ items, onOpen, onDismiss, onUndoDismiss }: NotifyRailProps) {
  return (
    <div
      data-testid="notify-rail"
      className="pointer-events-auto flex max-h-full flex-col gap-1 overflow-y-auto"
      onScroll={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <RailItem key={item.id} item={item} onOpen={onOpen} onDismiss={onDismiss} onUndoDismiss={onUndoDismiss} />
      ))}
    </div>
  );
}
