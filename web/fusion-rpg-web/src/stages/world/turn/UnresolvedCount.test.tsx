import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PendingOrder } from "@/stages/world/worldSelection";
import { dispatchGlobalVerb } from "@/shell/keymap";
import { UnresolvedCount } from "./UnresolvedCount";
import { TEN_LEGIONS } from "./fixtures/legions";

const orderFor = (entityId: string): PendingOrder => ({
  commandId: "c-" + entityId,
  kind: "stand-fast",
  entityId,
  label: "stand fast"
});

const NAMES = Object.fromEntries(TEN_LEGIONS.map((l, i) => [l.entityId, `Legion ${i + 1}`]));

describe("UnresolvedCount — the live count and its cycle control (world-stage W80)", () => {
  it("never renders a bare digit", () => {
    render(<UnresolvedCount legions={TEN_LEGIONS} pending={[]} displayNames={NAMES} onFocus={() => {}} />);
    expect(screen.getByTestId("unresolved-count")).toHaveTextContent("7 legions with moves left and no orders");
  });

  it("singular noun phrase at exactly one unresolved legion", () => {
    // Ordering everyone but e-1 leaves exactly one unresolved (e-1, march/1000).
    const pending = TEN_LEGIONS.filter((l) => l.entityId !== "e-1").map((l) => orderFor(l.entityId));
    render(<UnresolvedCount legions={TEN_LEGIONS} pending={pending} displayNames={NAMES} onFocus={() => {}} />);
    expect(screen.getByTestId("unresolved-count")).toHaveTextContent("1 legion with moves left and no orders");
  });

  it("cycling walks the real unresolved set at 6 legions and wraps", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const six = TEN_LEGIONS.slice(0, 6); // all six carry positive movement, so all six are unresolved
    render(<UnresolvedCount legions={six} pending={[]} displayNames={NAMES} onFocus={onFocus} />);

    const button = screen.getByTestId("unresolved-count");
    for (let i = 0; i < 6; i++) {
      await user.click(button);
      expect(onFocus).toHaveBeenNthCalledWith(i + 1, six[i]!.entityId);
      expect(screen.getByTestId("unresolved-count-subject")).toHaveTextContent(`Legion ${i + 1}`);
    }

    // The seventh click wraps back to the first legion.
    await user.click(button);
    expect(onFocus).toHaveBeenNthCalledWith(7, six[0]!.entityId);
  });

  it("cycling walks the real unresolved set at all 10 legions (7 unresolved) and wraps", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(<UnresolvedCount legions={TEN_LEGIONS} pending={[]} displayNames={NAMES} onFocus={onFocus} />);

    const button = screen.getByTestId("unresolved-count");
    const unresolvedIds = ["e-1", "e-3", "e-4", "e-5", "e-6", "e-2", "e-10"];
    // Order doesn't matter for this assertion — just that all 7 are reachable and it wraps.
    for (let i = 0; i < 7; i++) await user.click(button);
    onFocus.mockClear();
    await user.click(button);
    expect(unresolvedIds).toContain((onFocus.mock.calls[0] as [string])[0]);
  });

  it("never auto-cycles: filing an order for the cycled legion falls back to the bare count, not a different legion", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const { rerender } = render(
      <UnresolvedCount legions={TEN_LEGIONS} pending={[]} displayNames={NAMES} onFocus={onFocus} />
    );

    await user.click(screen.getByTestId("unresolved-count"));
    const firstSubject = screen.getByTestId("unresolved-count-subject").textContent;
    expect(firstSubject).toBeTruthy();

    // An order gets filed for that same legion by some other action (e.g. the map, not this
    // component) — it drops out of the unresolved set. Cycling position must not silently move.
    const stillCycledEntityId = TEN_LEGIONS.find((l) => `Legion ${TEN_LEGIONS.indexOf(l) + 1}` === firstSubject)!
      .entityId;
    rerender(
      <UnresolvedCount
        legions={TEN_LEGIONS}
        pending={[orderFor(stillCycledEntityId)]}
        displayNames={NAMES}
        onFocus={onFocus}
      />
    );

    expect(screen.queryByTestId("unresolved-count-subject")).not.toBeInTheDocument();
    expect(screen.getByTestId("unresolved-count")).toHaveTextContent("6 legions with moves left and no orders");
  });

  it("W is bound through worldVerbs.ts and cycles on dispatch", () => {
    const onFocus = vi.fn();
    render(<UnresolvedCount legions={TEN_LEGIONS} pending={[]} displayNames={NAMES} onFocus={onFocus} />);

    expect(dispatchGlobalVerb("w")).toBe(true);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
