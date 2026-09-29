import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

const switchTo = vi.fn(async () => 12);
const destroy = vi.fn(async () => undefined);
const fakeIdentity = { tag: "fake-game" };
const getGameIdentity = vi.fn(() => fakeIdentity);
const getMode = vi.fn(() => "world");

vi.mock("@/game/poc/scene-switch", async () => {
  const timing = await import("@/game/poc/scene-switch/timingStats");
  return {
    ...timing,
    POC_MODES: ["world", "siege", "lawn"],
    createPocController: () => ({
      track: "A",
      getGame: () => null,
      getGameIdentity,
      getMode,
      switchTo,
      destroy
    })
  };
});

import { PhaserSceneSwitchPocPage } from "./PhaserSceneSwitchPocPage";

describe("PhaserSceneSwitchPocPage", () => {
  it("renders chrome and records a mode switch sample", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PhaserSceneSwitchPocPage />);
    expect(screen.getByTestId("phaser-scene-poc")).toBeInTheDocument();
    expect(screen.getByTestId("phaser-scene-poc-canvas")).toBeInTheDocument();

    await user.click(screen.getByTestId("phaser-scene-poc-mode-siege"));
    await waitFor(() => expect(switchTo).toHaveBeenCalledWith("siege"));
    await waitFor(() => expect(screen.getByTestId("phaser-scene-poc-metrics").textContent).toMatch(/12/));
  });

  it("GG-11 panel keeps the same Game identity token on Track A", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PhaserSceneSwitchPocPage />);
    await user.click(screen.getByTestId("phaser-scene-poc-panel-open"));
    expect(screen.getByTestId("phaser-scene-poc-panel")).toBeInTheDocument();
    await user.click(screen.getByTestId("phaser-scene-poc-panel-close"));
    await waitFor(() =>
      expect(screen.getByTestId("phaser-scene-poc-metrics").textContent).toMatch(/GG-11 identity: STABLE/)
    );
  });
});
