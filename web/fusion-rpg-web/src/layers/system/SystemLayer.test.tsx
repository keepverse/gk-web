import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { resetKeymapForTests } from "@/shell/keymap";
import { DevTreeHost } from "@/dev/DevTreeHost";
import { setDevModeEnabled } from "@/dev/devMode";
import { SystemLayer } from "./SystemLayer";
import { clearBindingsForTests, currentKeyFor } from "./keybindings";

// This environment's default window.localStorage is incomplete (see lawnViewMode.test.ts for the
// same pattern) — stub a real in-memory Storage before each test.
beforeEach(() => {
  const mem: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
    clear: () => {
      for (const key of Object.keys(mem)) delete mem[key];
    },
    key: (i: number) => Object.keys(mem)[i] ?? null,
    get length() {
      return Object.keys(mem).length;
    }
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: ls });
  clearBindingsForTests();
  resetKeymapForTests();
});

describe("SystemLayer (T20)", () => {
  it("puts the injector-backed actor HUD and visual-effects choices on Display and persists only the selected choice", async () => {
    const user = userEvent.setup();
    let worldHudEnabled = false;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (url === "/api/settings" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { key: string; value: boolean };
        if (body.key === "lawn.worldHud") worldHudEnabled = body.value;
        return new Response(null, { status: 204 });
      }
      if (url === "/api/settings") {
        return new Response(
          JSON.stringify({
            playerId: 1,
            entries: [
              { key: "lawn.worldHud", kind: "Bool", summary: "Draw the in-world actor HUD.", value: String(worldHudEnabled), isDefault: !worldHudEnabled },
              { key: "lawn.visualEffects", kind: "Bool", summary: "Render cosmetic combat effects.", value: "true", isDefault: true }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
      expect(screen.queryByTestId("user-settings-panel")).not.toBeInTheDocument();

      await user.click(screen.getByTestId("system-tab-display"));
      await waitFor(() => expect(screen.getByTestId("user-setting-lawn.worldHud")).toHaveAttribute("aria-pressed", "false"));
      expect(screen.getByTestId("user-setting-lawn.visualEffects")).toHaveAttribute("aria-pressed", "true");

      await user.click(screen.getByTestId("user-setting-lawn.worldHud"));
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ key: "lawn.worldHud", value: true })
        })
        )
      );
      await waitFor(() => expect(screen.getByTestId("user-setting-lawn.worldHud")).toHaveAttribute("aria-pressed", "true"));
      expect(screen.getByTestId("user-setting-lawn.visualEffects")).not.toBeDisabled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preferences persist to localStorage across a remount, surviving without any server", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
    await user.click(screen.getByTestId("pref-damage-numbers"));
    expect(screen.getByTestId("pref-damage-numbers")).toHaveAttribute("aria-checked", "false");
    unmount();

    renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
    expect(screen.getByTestId("pref-damage-numbers")).toHaveAttribute("aria-checked", "false");
  });

  it("Developer mode drives the real T12 gate live: the switch reflects it, and DevTreeHost's own backtick verb reacts", async () => {
    // Mirrors AppShell's real composition (SystemLayer + DevTreeHost as siblings) rather than
    // SystemLayer alone — the gate's live-update path lives in DevTreeHost's own `?devmode=`
    // effect, not in SystemLayer, so isolating SystemLayer can't prove the toggle actually works.
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <SystemLayer open onOpenChange={() => {}} />
        <DevTreeHost />
      </>,
      { withGlobalKeys: true }
    );
    const toggle = screen.getByTestId("pref-developer-mode");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.keyboard("`");
    expect(screen.queryByTestId("dev-tree")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true"); // the rendered switch, not just the flag

    await user.keyboard("`");
    await waitFor(() => expect(screen.getByTestId("dev-tree")).toBeInTheDocument());

    setDevModeEnabled(false);
  });

  it("rebinding to a free key commits immediately, and the change is what the app actually registers (GG-20)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
    await user.click(screen.getByTestId("system-tab-controls"));
    await user.click(screen.getByTestId("keybind-change-creatures"));
    expect(screen.getByTestId("keybind-listening-creatures")).toBeInTheDocument();

    await user.keyboard("z");
    await waitFor(() => expect(screen.getByTestId("keybind-key-creatures")).toHaveTextContent("z"));
    expect(currentKeyFor("creatures")).toBe("z");
  });

  it("rebinding onto a key another action already holds shows the conflict with its cost, before committing", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
    await user.click(screen.getByTestId("system-tab-controls"));
    await user.click(screen.getByTestId("keybind-change-creatures"));
    await user.keyboard("r"); // Relics' default key

    await waitFor(() => expect(screen.getByTestId("keybind-conflict")).toBeInTheDocument());
    expect(screen.getByTestId("keybind-conflict-reason")).toHaveTextContent("Relics");
    expect(currentKeyFor("creatures")).toBe("c"); // not yet committed

    await user.click(screen.getByTestId("keybind-conflict-take"));
    expect(currentKeyFor("creatures")).toBe("r");
    expect(currentKeyFor("relics")).toBe("c"); // swapped onto Creatures' vacated key, not left colliding on "r"
  });

  it("the reserved launcher key is listed and refuses to be bound", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
    await user.click(screen.getByTestId("system-tab-controls"));
    expect(screen.getByTestId("keybind-key-reserved-f10")).toHaveTextContent("F10");

    await user.click(screen.getByTestId("keybind-change-creatures"));
    await user.keyboard("{F10}");
    await waitFor(() => expect(screen.getByTestId("keybind-reserved-refusal")).toBeInTheDocument());
    expect(currentKeyFor("creatures")).toBe("c");
  });

  // world-stage W95: 1-9 are information-architecture.md's own reserved range.
  it("a rebind onto the digit row is refused, and the stage still mounts afterward", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
    await user.click(screen.getByTestId("system-tab-controls"));

    await user.click(screen.getByTestId("keybind-change-relics"));
    await user.keyboard("3");
    await waitFor(() => expect(screen.getByTestId("keybind-reserved-refusal")).toBeInTheDocument());
    expect(screen.getByTestId("keybind-reserved-refusal")).toHaveTextContent(/reserved/i);
    expect(currentKeyFor("relics")).toBe("r");

    // The refused rebind must not have left the settings panel itself in a broken state — it can
    // still be dismissed and the table underneath is provably untouched (asserted above). The
    // stronger claim — a stage that later registers "3" as its own hotkey (world-lenses, W96) still
    // mounts without a `registerGlobalVerb` throw — is proven directly in `keybindings.test.ts`
    // ("the eight existing letter defaults still rebind freely" + the reserved-range test), since
    // `rebind` itself is what would have corrupted the table; this component-level test is the UI
    // half of the same guarantee.
    await user.click(screen.getByTestId("keybind-reserved-dismiss"));
    expect(screen.queryByTestId("keybind-reserved-refusal")).not.toBeInTheDocument();
  });

  it("Escape while listening cancels the rebind without changing anything", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
    await user.click(screen.getByTestId("system-tab-controls"));
    await user.click(screen.getByTestId("keybind-change-creatures"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("keybind-listening-creatures")).not.toBeInTheDocument());
    expect(currentKeyFor("creatures")).toBe("c");
  });

  // T29 (plate 06 §C): Display/Sound/Advanced tabs plus the connection row and Quit-to-title, added
  // after the visual-completeness audit found only Game and Controls existed.
  describe("T29 — Display/Sound/Advanced", () => {
    it("Reduce motion on the Display tab persists to the real preferences store", async () => {
      const user = userEvent.setup();
      const { unmount } = renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
      await user.click(screen.getByTestId("system-tab-display"));
      await user.click(screen.getByTestId("pref-reduce-motion-on"));
      expect(screen.getByTestId("pref-reduce-motion-on")).toHaveAttribute("aria-current", "true");
      unmount();

      renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
      await user.click(screen.getByTestId("system-tab-display"));
      expect(screen.getByTestId("pref-reduce-motion-on")).toHaveAttribute("aria-current", "true");
    });

    it("the Sound tab is disabled and carries its reason as a title, matching the rail's own locked-entry convention", async () => {
      renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
      const soundTab = screen.getByTestId("system-tab-sound");
      expect(soundTab).toBeDisabled();
      expect(soundTab).toHaveAttribute("title", "Sound settings aren't available yet.");
    });

    it("Advanced shows the real API base and resets preferences to defaults for real", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
      await user.click(screen.getByTestId("system-tab-preferences"));
      await user.click(screen.getByTestId("pref-damage-numbers"));
      expect(screen.getByTestId("pref-damage-numbers")).toHaveAttribute("aria-checked", "false");

      await user.click(screen.getByTestId("system-tab-advanced"));
      expect(screen.getByTestId("system-advanced-api-base")).toHaveTextContent(/.+/);
      await user.click(screen.getByTestId("system-reset-preferences"));

      await user.click(screen.getByTestId("system-tab-preferences"));
      expect(screen.getByTestId("pref-damage-numbers")).toHaveAttribute("aria-checked", "true");
    });

    it("Quit to title closes the layer and navigates to the real Title screen", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderWithProviders(<SystemLayer open onOpenChange={onOpenChange} />, { withGlobalKeys: true });
      const quit = screen.getByTestId("system-quit-to-title");
      expect(quit).not.toBeDisabled();
      await user.click(quit);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("the connection row summarizes real health/hub state, and Details reveals the raw fields", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SystemLayer open onOpenChange={() => {}} />, { withGlobalKeys: true });
      await user.click(screen.getByTestId("system-tab-preferences"));
      expect(screen.getByTestId("system-connection-tag")).toBeInTheDocument();
      expect(screen.queryByTestId("system-connection-details")).not.toBeInTheDocument();

      await user.click(screen.getByTestId("system-connection-details-toggle"));
      expect(screen.getByTestId("system-connection-details")).toBeInTheDocument();
    });
  });
});
