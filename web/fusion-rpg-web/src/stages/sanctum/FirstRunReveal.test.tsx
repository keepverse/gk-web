import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstRunReveal } from "./FirstRunReveal";

describe("FirstRunReveal (legacy compatibility)", () => {
  it("renders the legacy plate copy while the server-backed flow is pending", () => {
    render(<FirstRunReveal onBind={vi.fn()} />);
    expect(screen.getByText("This one answered")).toBeInTheDocument();
    expect(screen.getByText(/A sunflower has bound itself to you/)).toBeInTheDocument();
    expect(screen.queryByText("Bind your first creature")).not.toBeInTheDocument();
    expect(screen.queryByText("Open Creatures")).not.toBeInTheDocument();
  });

  it("calls onBind when Bind is clicked", async () => {
    const onBind = vi.fn();
    const user = userEvent.setup();
    render(<FirstRunReveal onBind={onBind} />);
    await user.click(screen.getByTestId("focus-card-cta"));
    expect(onBind).toHaveBeenCalledTimes(1);
  });

  it("renders no input — naming has no backend to write to yet", () => {
    const { container } = render(<FirstRunReveal onBind={vi.fn()} />);
    expect(container.querySelector("input")).toBeNull();
  });

  it("preserves the reveal's own testid for downstream Sanctum wiring", () => {
    render(<FirstRunReveal onBind={vi.fn()} />);
    expect(screen.getByTestId("focus-card-first-run")).toBeInTheDocument();
  });
});
