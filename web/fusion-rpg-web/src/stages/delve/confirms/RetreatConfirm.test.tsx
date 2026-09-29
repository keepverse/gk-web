import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RetreatConfirm } from "./RetreatConfirm";

describe("RetreatConfirm (D5.8, spec-delve-stage.md §7/§8 — 'retreat' reads as 'Fall back')", () => {
  it("shows the exact §8 phrase as the title and confirm label, danger-toned (a real forfeit, unlike Extract)", () => {
    render(<RetreatConfirm open onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("Fall back")).toBeInTheDocument();
    const confirmBtn = screen.getByTestId("retreat-confirm-confirm");
    expect(confirmBtn).toHaveTextContent("Retreat");
    expect(confirmBtn.className).toMatch(/bg-bad/);
  });

  it("Retreat fires onConfirm; Keep going fires onCancel", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<RetreatConfirm open onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByTestId("retreat-confirm-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("retreat-confirm-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape cancels when not busy", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<RetreatConfirm open onConfirm={() => {}} onCancel={onCancel} />);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    render(<RetreatConfirm open={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByTestId("retreat-confirm")).not.toBeInTheDocument();
  });
});
