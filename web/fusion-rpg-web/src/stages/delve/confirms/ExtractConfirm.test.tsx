import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExtractConfirm } from "./ExtractConfirm";

describe("ExtractConfirm (D5.8, spec-delve-stage.md §7/§8 — 'extract' reads as 'Leave with the haul')", () => {
  it("shows the exact §8 phrase as the title and confirm label, and states the real unclaimed-souls figure through formatMagnitude, not a raw number", () => {
    render(
      <ExtractConfirm
        open
        unclaimedSouls={{ unit: "count", value: 4120 }}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText("Leave with the haul")).toBeInTheDocument();
    expect(screen.getByTestId("extract-confirm-confirm")).toHaveTextContent("Extract");
    // Intl.NumberFormat("en") renders 4120 as "4,120" — proves the real formatter ran, not String(value).
    expect(screen.getByTestId("extract-confirm")).toHaveTextContent("4,120 unclaimed souls");
  });

  it("Extract fires onConfirm; Stay fires onCancel", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ExtractConfirm open unclaimedSouls={{ unit: "count", value: 0 }} onConfirm={onConfirm} onCancel={onCancel} />
    );
    await user.click(screen.getByTestId("extract-confirm-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("extract-confirm-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("busy disables both controls and carries a title reason on each (GG-55, disabledReasonGuard)", () => {
    render(
      <ExtractConfirm open unclaimedSouls={{ unit: "count", value: 0 }} busy onConfirm={() => {}} onCancel={() => {}} />
    );
    const confirmBtn = screen.getByTestId("extract-confirm-confirm");
    const cancelBtn = screen.getByTestId("extract-confirm-cancel");
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveAttribute("title");
    expect(cancelBtn).toBeDisabled();
    expect(cancelBtn).toHaveAttribute("title");
  });

  it("renders nothing when closed", () => {
    render(
      <ExtractConfirm open={false} unclaimedSouls={{ unit: "count", value: 0 }} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.queryByTestId("extract-confirm")).not.toBeInTheDocument();
  });
});
