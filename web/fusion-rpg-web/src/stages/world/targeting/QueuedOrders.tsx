import type { PendingOrder } from "@/stages/world/worldSelection";

export type QueuedOrdersProps = {
  orders: PendingOrder[];
  onTakeBack: (commandId: string) => void;
};

/**
 * The queued-order list (world-stage W71) — filing an order and ending the turn are two separate
 * acts; between them, the order exists and is drawn, but nothing has resolved. Each row names the
 * order in player words (`PendingOrder.label` — the caller's own job to phrase, this component only
 * renders it) and carries *take back*, which fires `worldSelection.ts`'s existing `unqueue` (already
 * correct: keyed by `orderId`, so filing the same order twice replaces rather than stacks, and
 * take-back removes it and re-submits the remainder — no new logic needed here, just the control).
 *
 * **A standing order is re-issued whole each turn — the interface never pretends otherwise**: an
 * empty list after commit (this component's own absence, not a lingering "0 orders" row) is what
 * tells the player the server keeps no multi-turn memory.
 *
 * **Not built here, and said so rather than faked**: "queueing a march does not move the marker —
 * the token stays at `atSectorId` and the destination carries a flag" is a claim about the *map's*
 * own rendering (`LegionMarker`/a destination flag), not this list — proving it needs a real,
 * clickable map to select→highlight→click against, which does not exist yet (the same wiring gap
 * this program has already named at W50/W57/W65). This component only owns the queue list itself.
 */
export function QueuedOrders({ orders, onTakeBack }: QueuedOrdersProps) {
  if (orders.length === 0) {
    return (
      <p data-testid="queued-orders-empty" className="pointer-events-auto text-sm text-muted">
        Nothing queued.
      </p>
    );
  }

  return (
    <ul data-testid="queued-orders" className="pointer-events-auto flex flex-col gap-1">
      {orders.map((order) => (
        <li
          key={order.commandId}
          data-testid={`queued-order-${order.commandId}`}
          className="flex items-center justify-between gap-2 text-sm text-text"
        >
          <span data-testid={`queued-order-label-${order.commandId}`}>{order.label}</span>
          <button
            type="button"
            data-testid={`queued-order-take-back-${order.commandId}`}
            className="rounded-sm border border-border px-2 py-1 text-xs"
            onClick={() => onTakeBack(order.commandId)}
          >
            Take back
          </button>
        </li>
      ))}
    </ul>
  );
}
