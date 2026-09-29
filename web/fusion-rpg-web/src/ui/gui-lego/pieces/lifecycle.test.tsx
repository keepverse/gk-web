import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { phaseEmptyFactory, phaseLoadingFactory, phasePendingFactory } from "./lifecycle";

const bus = { emit: vi.fn() } as never;

/**
 * GG-23: the lifecycle piece used to render its own class name as visible text
 * (`<strong>phase-loading</strong>`), which leaked engine vocabulary to the player beside the
 * real message. `data-phase` carries the state for CSS and tests; `message` carries the copy.
 */
describe("lifecycle pieces — no engine vocabulary in player text", () => {
  it("renders the message without the phase class name", () => {
    const { container } = render(
      <>{phaseLoadingFactory({ payload: { piece: "phase-loading", instanceId: "x", phase: "ready" }, slots: {}, bus })}</>
    );
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(container.textContent).not.toContain("phase-loading");
    expect(container.querySelector("strong")).toBeNull();
  });

  it("still exposes the state on data-phase for CSS and tests", () => {
    const { container } = render(
      <>{phaseEmptyFactory({ payload: { piece: "phase-empty", instanceId: "x", phase: "ready" }, slots: {}, bus })}</>
    );
    const root = container.querySelector("[data-phase]");
    expect(root?.getAttribute("data-phase")).toBe("empty");
  });

  it("does not render the phase class name for any lifecycle kind", () => {
    for (const factory of [phaseLoadingFactory, phasePendingFactory]) {
      const { container } = render(
        <>{factory({ payload: { piece: "p", instanceId: "x", phase: "ready" }, slots: {}, bus })}</>
      );
      expect(container.textContent ?? "").not.toMatch(/phase-(loading|pending|empty|error)/);
    }
  });
});
