import type { RailItem as RailItemData } from "./railStore";
import { ChannelControl } from "./ChannelControl";

export type RailItemProps = {
  item: RailItemData;
  onOpen: (id: string) => void;
  onDismiss: (id: string) => void;
  onUndoDismiss: (id: string) => void;
};

/**
 * world-stage W87 (spec-world-notify.md §3) — the five rail-item states, each carried by more than
 * colour alone (GG-27/GG-30): unread is a dot **and** bold weight **and** a left rule; blocking has
 * **no** close control and a **visible-but-locked** channel control, queried here by role and
 * accessible name so a test can prove the control's absence rather than its class.
 */
export function RailItem({ item, onOpen, onDismiss, onUndoDismiss }: RailItemProps) {
  if (item.state === "dismissed") {
    return (
      <div data-testid={`rail-item-${item.id}`} data-item-state="dismissed" className="flex items-center justify-between gap-2 py-1 text-xs text-muted">
        <span>Dismissed</span>
        <button type="button" onClick={() => onUndoDismiss(item.id)}>
          Undo
        </button>
      </div>
    );
  }

  if (item.state === "minimized") {
    return (
      <div data-testid={`rail-item-${item.id}`} data-item-state="minimized" className="flex items-center gap-2 py-1 text-xs text-muted">
        <span aria-hidden="true">▪</span>
        <span>{item.title}</span>
      </div>
    );
  }

  const unread = item.state === "unread";

  return (
    <div
      data-testid={`rail-item-${item.id}`}
      data-item-state={item.state}
      className="flex flex-col gap-1 border-l-4 border-accent py-1 pl-2"
      onClick={unread ? () => onOpen(item.id) : undefined}
    >
      <div className="flex items-center gap-2">
        {unread ? (
          <span aria-hidden="true" data-testid={`rail-item-dot-${item.id}`}>
            ●
          </span>
        ) : null}
        <p className={unread ? "font-bold text-text" : "font-normal text-text"}>
          {unread ? <span className="sr-only">Unread: </span> : null}
          {item.title}
        </p>
      </div>

      {!unread ? <p className="text-xs text-muted">{item.body}</p> : null}

      <div className="flex items-center justify-between gap-2" onClick={(event) => event.stopPropagation()}>
        <ChannelControl category={item.category} locked={item.blocking} />

        {!item.blocking && !unread ? (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(event) => {
              event.stopPropagation();
              onDismiss(item.id);
            }}
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
