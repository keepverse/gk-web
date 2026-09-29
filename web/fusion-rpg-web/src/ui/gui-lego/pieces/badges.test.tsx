import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { resolveTheme } from "@/features/gui-lego/themeRegistry";
import { isShieldSummaryMountable } from "@/features/gui-lego/shieldMount";
import type { PiecePayload, SurfaceBusLike } from "@/features/gui-lego/types";
import {
  elementBadgeFactory,
  phaseBadgeFactory,
  roleBadgeFactory,
  shieldStatusFactory
} from "./badges";

const bus: SurfaceBusLike = { emit: () => undefined, on: () => () => undefined };

function renderFactory(
  factory: typeof elementBadgeFactory,
  payload: PiecePayload
) {
  return render(<>{factory({ payload, slots: {}, bus })}</>);
}

describe("role-badge", () => {
  it("renders themed label from side plant pack", () => {
    const themeRef = { kind: "side" as const, id: "plant" };
    renderFactory(roleBadgeFactory, {
      piece: "role-badge",
      instanceId: "rail:role:a1",
      phase: "ready",
      label: "Plant",
      themeRef,
      themeResolved: resolveTheme(themeRef)
    });
    const badge = screen.getByTestId("role-badge");
    expect(badge).toHaveTextContent("Plant");
    expect(badge).toHaveStyle({ "--piece-accent": "#6fbf73" });
  });

  it("omits when label empty", () => {
    const { container } = renderFactory(roleBadgeFactory, {
      piece: "role-badge",
      instanceId: "rail:role:x",
      phase: "ready",
      label: "  "
    });
    expect(container).toBeEmptyDOMElement();
  });
});

describe("element-badge", () => {
  it("uses paint SSOT accent for dark", () => {
    const themeRef = { kind: "element" as const, id: "dark" };
    renderFactory(elementBadgeFactory, {
      piece: "element-badge",
      instanceId: "condition:el:dark",
      phase: "ready",
      elementId: "dark",
      label: "Dark",
      themeRef,
      themeResolved: resolveTheme(themeRef)
    });
    const badge = screen.getByTestId("element-badge-dark");
    expect(badge).toHaveAttribute("data-el", "dark");
    expect(badge).toHaveTextContent("Dark");
    expect(badge).toHaveStyle({ "--piece-accent": "#8b7bab" });
  });
});

describe("phase-badge", () => {
  it("renders fiction phase label with side paint", () => {
    const themeRef = { kind: "side" as const, id: "plant" };
    renderFactory(phaseBadgeFactory, {
      piece: "phase-badge",
      instanceId: "condition:phase",
      phase: "ready",
      label: "Ascendant",
      themeRef,
      themeResolved: resolveTheme(themeRef)
    });
    expect(screen.getByTestId("phase-badge")).toHaveTextContent("Ascendant");
  });
});

describe("shield-status", () => {
  it("mounts HP + element paint when current > 0", () => {
    const themeRef = { kind: "element" as const, id: "ice" };
    renderFactory(shieldStatusFactory, {
      piece: "shield-status",
      instanceId: "condition:shield",
      phase: "ready",
      current: 1200,
      max: 2000,
      elementId: "ice",
      themeRef,
      themeResolved: resolveTheme(themeRef),
      currentText: "1,200",
      maxText: "2,000",
      stacks: 2
    });
    expect(screen.getByTestId("shield-status")).toHaveTextContent("1,200 / 2,000");
    expect(screen.getByTestId("shield-status")).toHaveTextContent("2 stacks");
  });

  it("omits when current <= 0 (Q3)", () => {
    const { container } = renderFactory(shieldStatusFactory, {
      piece: "shield-status",
      instanceId: "condition:shield",
      phase: "ready",
      current: 0,
      max: 2000,
      currentText: "0",
      maxText: "2,000"
    });
    expect(container).toBeEmptyDOMElement();
    expect(isShieldSummaryMountable({ current: 0, max: 2000 })).toBe(false);
    expect(isShieldSummaryMountable(null)).toBe(false);
    expect(isShieldSummaryMountable({ current: 10, max: 100 })).toBe(true);
  });
});
