import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { known, pendingWithReason } from "@/contract/pending";
import { WardenBlock } from "./WardenBlock";
import { DowseBlock } from "./DowseBlock";
import { maximalSector } from "./fixtures/maximalSector";

describe("WardenBlock — honest about what is not wired (world-stage W63)", () => {
  it("a known binding renders the id — this sector's own case", () => {
    render(<WardenBlock sector={{ ...maximalSector, wardenBindingId: known("e-dave-warden-1") }} />);
    expect(screen.getByTestId("warden-block")).toHaveTextContent("e-dave-warden-1");
  });

  it("a known-null binding renders a plain sentence, never a blank or a zero", () => {
    render(<WardenBlock sector={{ ...maximalSector, wardenBindingId: known(null) }} />);
    expect(screen.getByTestId("warden-block")).toHaveTextContent("No warden bound.");
  });

  it("a Pending binding (the caller never asked, or the wire genuinely can't say) renders its own reason, never a blank", () => {
    render(<WardenBlock sector={{ ...maximalSector, wardenBindingId: pendingWithReason("not surveyed recently enough to know") }} />);
    expect(screen.getByTestId("warden-block")).toHaveTextContent("not surveyed recently enough to know");
  });
});

describe("DowseBlock — states what prospecting found, offers no verb the vocabulary lacks (world-stage W63)", () => {
  it("a confirmed source renders plainly", () => {
    render(<DowseBlock prospected={true} />);
    expect(screen.getByTestId("dowse-block")).toHaveTextContent("A dowser has confirmed a loam source here this turn.");
  });

  it("no survey this turn renders plainly, never a blank", () => {
    render(<DowseBlock prospected={false} />);
    expect(screen.getByTestId("dowse-block")).toHaveTextContent("No dowser has surveyed this ground this turn.");
  });

  it("offers no stance button — the verb belongs to world-targeting, not this read-only block", () => {
    const { container } = render(<DowseBlock prospected={true} />);
    expect(container.querySelector("button")).toBeNull();
  });
});
