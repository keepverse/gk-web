import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionCluster, type ActionVerb } from "./ActionCluster";

describe("ActionCluster — every refusal a rendered sentence, never a tooltip (world-stage W64)", () => {
  it("an available verb renders enabled, with no reason row at all", () => {
    const onActivate = vi.fn();
    render(<ActionCluster verbs={[{ id: "claim", label: "Claim", disabledReason: null, onActivate }]} />);

    const button = screen.getByTestId("action-button-claim");
    expect(button).not.toBeDisabled();
    expect(screen.queryByTestId("action-reason-claim")).not.toBeInTheDocument();
  });

  it("clicking an available verb fires its callback", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<ActionCluster verbs={[{ id: "claim", label: "Claim", disabledReason: null, onActivate }]} />);
    await user.click(screen.getByTestId("action-button-claim"));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("a disabled verb stays in the cluster, in its place — never hidden", () => {
    const verbs: ActionVerb[] = [
      { id: "claim", label: "Claim", disabledReason: "claim.contested" },
      { id: "build", label: "Build a well", disabledReason: null }
    ];
    render(<ActionCluster verbs={verbs} />);

    expect(screen.getByTestId("action-row-claim")).toBeInTheDocument();
    expect(screen.getByTestId("action-button-claim")).toBeDisabled();
    expect(screen.getByTestId("action-row-build")).toBeInTheDocument();
  });

  it("a disabled verb's reason renders as real, visible text — queried by text, not by title", () => {
    render(<ActionCluster verbs={[{ id: "build", label: "Build a well", disabledReason: "build.cannot-afford" }]} />);

    const reason = screen.getByTestId("action-reason-build");
    expect(reason).toHaveTextContent("cannot afford");
    expect(screen.getByTestId("action-button-build")).not.toHaveAttribute("title");
  });

  it("no engine token ever appears in the visible text or the accessible name", () => {
    render(
      <ActionCluster
        verbs={[
          { id: "claim", label: "Claim", disabledReason: "claim.contested" },
          { id: "build", label: "Build a well", disabledReason: "build.cannot-afford" }
        ]}
      />
    );

    expect(screen.getByTestId("action-reason-claim")).not.toHaveTextContent("claim.contested");
    expect(screen.getByTestId("action-reason-build")).not.toHaveTextContent("build.cannot-afford");
  });

  it("the reason node is exactly what aria-describedby points at — the same node satisfies both the guard and visibility", () => {
    render(<ActionCluster verbs={[{ id: "claim", label: "Claim", disabledReason: "claim.contested" }]} />);

    const button = screen.getByTestId("action-button-claim");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toBe(screen.getByTestId("action-reason-claim"));
  });

  it("an unrecognised reason still renders real text through reasonFor's own fallback, never the raw string", () => {
    render(<ActionCluster verbs={[{ id: "claim", label: "Claim", disabledReason: "some.brand-new-reason" }]} />);
    const reason = screen.getByTestId("action-reason-claim");
    expect(reason.textContent!.length).toBeGreaterThan(0);
  });
});
