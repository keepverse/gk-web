import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BindWardenDialog, type WardenRefusalReason } from "./BindWardenDialog";

function baseProps(overrides?: Partial<Parameters<typeof BindWardenDialog>[0]>) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    creatureName: "Ashkell",
    sectorName: "Frost Mire",
    slotsUsedAfterBind: 7,
    slotsCapacity: 8,
    fee: 400,
    upkeepPerDay: 400,
    balance: 520,
    refusal: null,
    onConfirm: vi.fn(),
    ...overrides
  };
}

describe("BindWardenDialog (world-stage W102/W103, spec-world-confirms.md §2, §3)", () => {
  it("all five rows are present, plus the same-rate sentence", () => {
    render(<BindWardenDialog {...baseProps()} />);
    expect(screen.getByTestId("warden-row-permanent")).toBeInTheDocument();
    expect(screen.getByTestId("warden-row-slot")).toHaveTextContent("7 / 8 used");
    expect(screen.getByTestId("warden-row-fee")).toHaveTextContent("400");
    expect(screen.getByTestId("warden-row-upkeep")).toHaveTextContent("400");
    expect(screen.getByTestId("warden-row-exemption")).toHaveTextContent("Frost Mire");
    expect(screen.getByTestId("warden-same-rate")).toHaveTextContent("the same number");
  });

  it("the permanence copy is exact — GG-22's own required sentences", () => {
    render(<BindWardenDialog {...baseProps()} />);
    expect(screen.getByTestId("warden-permanence")).toHaveTextContent("can never be released");
    expect(screen.getByTestId("warden-keep-ground")).toHaveTextContent("You do not keep the creature.");
  });

  it('the word "Ward" appears nowhere in this dialog', () => {
    const { container } = render(<BindWardenDialog {...baseProps()} />);
    expect(container.textContent).not.toMatch(/\bWard\b/);
  });

  it("with a comfortable balance, Continue completes the flow in one step", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<BindWardenDialog {...baseProps({ balance: 10_000, onConfirm, onOpenChange })} />);

    await user.click(screen.getByTestId("warden-continue"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId("warden-bind-input")).not.toBeInTheDocument();
  });

  it("below the threshold, step 2 appears and states the balance/fee/rate arithmetic", async () => {
    const user = userEvent.setup();
    render(<BindWardenDialog {...baseProps({ balance: 500, fee: 400, upkeepPerDay: 400 })} />);

    await user.click(screen.getByTestId("warden-continue"));
    const arithmetic = screen.getByTestId("warden-arithmetic");
    expect(arithmetic).toHaveTextContent("500");
    expect(arithmetic).toHaveTextContent("400");
  });

  it("step 2's confirm stays disabled with its reason until \"bind\" is typed, then enables and commits", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<BindWardenDialog {...baseProps({ balance: 100, fee: 400, upkeepPerDay: 400, onConfirm })} />);

    await user.click(screen.getByTestId("warden-continue"));
    const confirm = screen.getByTestId("warden-confirm");
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute("title", expect.stringMatching(/bind/i));

    await user.type(screen.getByTestId("warden-bind-input"), "nope");
    expect(confirm).toBeDisabled();

    await user.clear(screen.getByTestId("warden-bind-input"));
    await user.type(screen.getByTestId("warden-bind-input"), "bind");
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("exactly at the threshold, step 2 does not appear (the boundary comes from wardenGate.ts, not recomputed here)", async () => {
    const user = userEvent.setup();
    render(<BindWardenDialog {...baseProps({ balance: 800, fee: 400, upkeepPerDay: 400 })} />);
    await user.click(screen.getByTestId("warden-continue"));
    expect(screen.queryByTestId("warden-arithmetic")).not.toBeInTheDocument();
  });

  const REFUSALS: { reason: WardenRefusalReason; expectedText: RegExp }[] = [
    { reason: "capacity.full", expectedText: /every binding slot is taken/i },
    { reason: "souls.insufficient", expectedText: /cannot pay the fee/i },
    { reason: "contract.already-bound", expectedText: /already under an ordinary contract/i },
    { reason: "specimen.missing", expectedText: /should never be reachable/i }
  ];

  it.each(REFUSALS)("engine refusal $reason renders as a sentence before the act (GG-55)", ({ reason, expectedText }) => {
    render(<BindWardenDialog {...baseProps({ refusal: reason })} />);
    expect(screen.getByTestId("warden-refusal")).toHaveTextContent(expectedText);
    expect(screen.queryByTestId("warden-continue")).not.toBeInTheDocument();
  });

  it("declares no z-index", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const text = readFileSync(join(__dirname, "BindWardenDialog.tsx"), "utf8");
    expect(text).not.toMatch(/zIndex\s*[:=]|z-index\s*:/);
  });

  it("closing and reopening resets to step 1", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BindWardenDialog {...baseProps({ balance: 100, fee: 400, upkeepPerDay: 400 })} />);
    await user.click(screen.getByTestId("warden-continue"));
    expect(screen.getByTestId("warden-arithmetic")).toBeInTheDocument();

    rerender(<BindWardenDialog {...baseProps({ balance: 100, fee: 400, upkeepPerDay: 400, open: false })} />);
    rerender(<BindWardenDialog {...baseProps({ balance: 100, fee: 400, upkeepPerDay: 400, open: true })} />);
    expect(screen.queryByTestId("warden-arithmetic")).not.toBeInTheDocument();
    expect(screen.getByTestId("warden-continue")).toBeInTheDocument();
  });
});
