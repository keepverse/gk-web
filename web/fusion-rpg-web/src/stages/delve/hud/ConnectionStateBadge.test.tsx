import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionStateBadge } from "./ConnectionStateBadge";

describe("ConnectionStateBadge (D5.6)", () => {
  it("renders the real label for each state and stamps data-status for the caller/tests to key off", () => {
    const { rerender } = render(<ConnectionStateBadge status="live" />);
    expect(screen.getByTestId("delve-connection-state")).toHaveAttribute("data-status", "live");
    expect(screen.getByTestId("delve-connection-state-label")).toHaveTextContent("Live");

    rerender(<ConnectionStateBadge status="reconnecting" />);
    expect(screen.getByTestId("delve-connection-state-label")).toHaveTextContent("Reconnecting…");

    rerender(<ConnectionStateBadge status="frozen" />);
    expect(screen.getByTestId("delve-connection-state-label")).toHaveTextContent("Your band is waiting.");

    rerender(<ConnectionStateBadge status="offline" />);
    expect(screen.getByTestId("delve-connection-state-label")).toHaveTextContent("Not connected");
  });

  it("never renders a raw status id as its own label text", () => {
    render(<ConnectionStateBadge status="reconnecting" />);
    const label = screen.getByTestId("delve-connection-state-label");
    expect(label).not.toHaveTextContent("reconnecting");
  });
});
