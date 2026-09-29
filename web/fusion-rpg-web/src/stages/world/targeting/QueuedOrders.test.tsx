import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PendingOrder } from "@/stages/world/worldSelection";
import { QueuedOrders } from "./QueuedOrders";

function order(overrides: Partial<PendingOrder> = {}): PendingOrder {
  return {
    commandId: "t0-move-e-dave-legion-1",
    kind: "move",
    entityId: "e-dave-legion-1",
    label: "March to Ember Hollow",
    ...overrides
  };
}

describe("QueuedOrders — filed, drawn, and takeable back (world-stage W71)", () => {
  it("an empty queue after commit renders its own absence, never a lingering '0 orders' row", () => {
    render(<QueuedOrders orders={[]} onTakeBack={() => {}} />);
    expect(screen.getByTestId("queued-orders-empty")).toHaveTextContent("Nothing queued.");
    expect(screen.queryByTestId("queued-orders")).not.toBeInTheDocument();
  });

  it("each queue row names the order in player words and carries take back", () => {
    render(<QueuedOrders orders={[order()]} onTakeBack={() => {}} />);
    expect(screen.getByTestId("queued-order-label-t0-move-e-dave-legion-1")).toHaveTextContent(
      "March to Ember Hollow"
    );
    expect(screen.getByTestId("queued-order-take-back-t0-move-e-dave-legion-1")).toHaveTextContent(
      "Take back"
    );
  });

  it("clicking take back fires the callback with the exact commandId, never a derived one", async () => {
    const user = userEvent.setup();
    const onTakeBack = vi.fn();
    render(<QueuedOrders orders={[order({ commandId: "t3-clear-e-dave-legion-2" })]} onTakeBack={onTakeBack} />);

    await user.click(screen.getByTestId("queued-order-take-back-t3-clear-e-dave-legion-2"));
    expect(onTakeBack).toHaveBeenCalledWith("t3-clear-e-dave-legion-2");
  });

  it("multiple queued orders each render their own row, in order, with no cross-contamination", () => {
    const orders = [
      order({ commandId: "t0-move-e-dave-legion-1", label: "March to Ember Hollow" }),
      order({ commandId: "t0-clear-e-dave-legion-2", label: "Clear the guard at Ash Waste" })
    ];
    render(<QueuedOrders orders={orders} onTakeBack={() => {}} />);

    expect(screen.getByTestId("queued-order-label-t0-move-e-dave-legion-1")).toHaveTextContent(
      "March to Ember Hollow"
    );
    expect(screen.getByTestId("queued-order-label-t0-clear-e-dave-legion-2")).toHaveTextContent(
      "Clear the guard at Ash Waste"
    );
  });
});
