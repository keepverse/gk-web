import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { AppShell } from "./AppShell";

vi.mock("@/lib/bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus")>();
  return {
    ...actual,
    useHealth: () => ({ data: {}, error: null }),
    usePlayers: () => ({ data: { items: [], currentPlayerId: 1 }, error: null }),
    useHubStatus: () => "ok"
  };
});

describe("AppShell — world-stage W34, the outlet's non-scrolling mode", () => {
  it("a stage route in NON_SCROLLING_ROUTES gets an unpadded, non-scrolling outlet", () => {
    renderWithProviders(<AppShell />, { route: "/world-stage" });

    const outlet = screen.getByTestId("page-outlet");
    expect(outlet.className).toContain("overflow-hidden");
    expect(outlet.className).not.toContain("overflow-auto");
    expect(outlet.className).not.toContain("p-5");
  });

  it("every other route keeps the original padded, scrolling outlet byte-identically", () => {
    renderWithProviders(<AppShell />, { route: "/sanctum" });

    const outlet = screen.getByTestId("page-outlet");
    expect(outlet.className).toBe("min-w-0 flex-1 overflow-auto p-5");
  });

  it("the lawn route also keeps the original outlet — this mode is route-scoped, not blanket", () => {
    renderWithProviders(<AppShell />, { route: "/lawn" });

    const outlet = screen.getByTestId("page-outlet");
    expect(outlet.className).toBe("min-w-0 flex-1 overflow-auto p-5");
  });
});
