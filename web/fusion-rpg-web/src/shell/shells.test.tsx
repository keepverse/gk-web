import { useState } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogShell } from "./DialogShell";
import { PanelShell } from "./PanelShell";
import { useLayerStack } from "./layerStack";
import { resetKeymapForTests } from "./keymap";
import { useGlobalKeys } from "./useGlobalKeys";

function OpenerHarness({ Shell, band }: { Shell: typeof PanelShell; band: "panel" | "dialog" }) {
  useGlobalKeys();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button data-testid="opener" onClick={() => setOpen(true)}>
        Open
      </button>
      <Shell
        open={open}
        onOpenChange={setOpen}
        title={band === "panel" ? "Roster" : "Confirm release"}
        testId="shell-under-test"
        footer={<button data-testid="footer-btn">Footer action</button>}
      >
        <button data-testid="body-btn-1">First</button>
        <button data-testid="body-btn-2">Second</button>
      </Shell>
    </div>
  );
}

describe.each([
  { name: "PanelShell", Shell: PanelShell, band: "panel" as const },
  { name: "DialogShell", Shell: DialogShell, band: "dialog" as const }
])("$name", ({ Shell, band }) => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
    resetKeymapForTests();
  });

  it("renders title, body and footer when open", () => {
    render(<Shell open onOpenChange={() => {}} title="Roster" testId="t">Body content</Shell>);
    expect(screen.getByTestId("t")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roster" })).toBeInTheDocument();
    expect(screen.getByTestId("t-body")).toHaveTextContent("Body content");
  });

  it("renders nothing when closed", () => {
    render(<Shell open={false} onOpenChange={() => {}} title="Roster" testId="t">Body content</Shell>);
    expect(screen.queryByTestId("t")).not.toBeInTheDocument();
  });

  it("registers itself on the shared LayerStack in the right band while open, and clears on close", async () => {
    const user = userEvent.setup();
    render(<OpenerHarness Shell={Shell} band={band} />);
    expect(useLayerStack.getState().layers).toEqual([]);

    await user.click(screen.getByTestId("opener"));
    await waitFor(() => expect(screen.getByTestId("shell-under-test")).toBeInTheDocument());
    expect(useLayerStack.getState().layers.map((l) => l.band)).toEqual([band]);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("shell-under-test")).not.toBeInTheDocument());
    expect(useLayerStack.getState().layers).toEqual([]);
  });

  it("traps Tab focus inside the shell's own controls", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button data-testid="outside-sentinel">Outside</button>
        <OpenerHarness Shell={Shell} band={band} />
      </div>
    );
    await user.click(screen.getByTestId("opener"));
    const shell = await screen.findByTestId("shell-under-test");

    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(shell.contains(document.activeElement)).toBe(true);
    }
  });

  it("restores focus to the opener after closing", async () => {
    const user = userEvent.setup();
    render(<OpenerHarness Shell={Shell} band={band} />);
    const opener = screen.getByTestId("opener");

    opener.focus();
    await user.click(opener);
    await screen.findByTestId("shell-under-test");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("shell-under-test")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe("PanelShell — the scrim sits below the HUD, not at the panel's own tier (GG-5 amendment, world-stage W55)", () => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
    resetKeymapForTests();
  });

  it("the panel's own scrim is band-scrim, never band-panel — the live defect this amendment fixes", () => {
    render(<PanelShell open onOpenChange={() => {}} title="Roster" testId="t">Body</PanelShell>);
    const overlay = screen.getByTestId("t-overlay");
    expect(overlay.className).toContain("band-scrim");
    expect(overlay.className).not.toContain("band-panel");
  });

  it("the panel's own content still stacks at band-panel, unchanged", () => {
    render(<PanelShell open onOpenChange={() => {}} title="Roster" testId="t">Body</PanelShell>);
    expect(screen.getByTestId("t").className).toContain("band-panel");
  });

  it("the system band's scrim is unaffected — the amendment named band-2 (Panel) only", () => {
    render(
      <PanelShell open onOpenChange={() => {}} title="Settings" testId="t" band="system">
        Body
      </PanelShell>
    );
    const overlay = screen.getByTestId("t-overlay");
    expect(overlay.className).toContain("band-system");
    expect(overlay.className).not.toContain("band-scrim");
  });
});

describe("PanelShell size variant (actor-sheet-shell)", () => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
    resetKeymapForTests();
  });

  it("default size keeps the compact GG-61 bound", () => {
    render(
      <PanelShell open onOpenChange={() => {}} title="Roster" testId="t">
        Body
      </PanelShell>
    );
    const el = screen.getByTestId("t");
    expect(el.className).toContain("max-h-[min(720px,82vh)]");
    expect(el.className).toContain("w-[min(640px,92vw)]");
  });

  it("actorSheet size uses the near-fullscreen bound without changing other panels", () => {
    render(
      <PanelShell open onOpenChange={() => {}} title="Actor" testId="t" size="actorSheet">
        Body
      </PanelShell>
    );
    const el = screen.getByTestId("t");
    expect(el.className).toContain("h-[min(960px,92vh)]");
    expect(el.className).toContain("w-[min(1800px,96vw)]");
  });

  it("headerMode none hides chrome and keeps title sr-only for a11y", () => {
    render(
      <PanelShell
        open
        onOpenChange={() => {}}
        title="Crazy Dave"
        testId="t"
        size="actorSheet"
        headerMode="none"
      >
        Body
      </PanelShell>
    );
    expect(screen.getByTestId("t-header")).toHaveAttribute("data-header-mode", "none");
    expect(screen.getByTestId("t-header").className).toContain("sr-only");
    expect(screen.queryByTestId("t-close")).not.toBeInTheDocument();
    expect(screen.getByTestId("t-body").className).toContain("flex");
  });
});

describe("PanelShell — token ordering for scrim (continued)", () => {
  it("--band-scrim sits strictly between --band-stage and --band-hud in the shipped tokens — the ordering the visual/interactive guarantee depends on", () => {
    // jsdom never loads the real Tailwind-generated stylesheet, so a class-name assertion (above)
    // is this repo's own established proof for GG-5 stacking (`Toasts.test.tsx`'s "is band-toast,
    // never a bespoke z-index"); the numeric ordering itself is verified here directly against the
    // real generated file, the same technique `bandGuard.test.ts` uses for the token definitions.
    const tokensCss = readFileSync(join(__dirname, "..", "theme", "tokens.css"), "utf8");
    const valueOf = (name: string) => {
      const match = new RegExp(`--${name}:\\s*(\\d+)`).exec(tokensCss);
      if (!match) throw new Error(`token --${name} not found in theme/tokens.css`);
      return Number(match[1]);
    };
    expect(valueOf("band-stage")).toBeLessThan(valueOf("band-scrim"));
    expect(valueOf("band-scrim")).toBeLessThan(valueOf("band-hud"));
    expect(valueOf("band-hud")).toBeLessThan(valueOf("band-panel"));
  });
});

/**
 * GG-6/GG-18/GG-19's own combined claim — push 3, pop 3, with the topmost owning focus and Esc
 * unwinding one level at a time back to where it started — needs three *real* stacked shells to
 * prove, not just the store's own push/pop bookkeeping (`layerStack.test.ts`) or one shell's
 * isolated focus trap (the suite above). This app's real UI rarely nests this deep (at most a
 * `PanelShell` plus a `ConfirmDialog`), but the mechanism itself has to hold at any depth GG-1
 * promises, so this proves it directly with a synthetic three-level harness.
 */
function ThreeDeepHarness() {
  useGlobalKeys();
  const [openA, setOpenA] = useState(false);
  const [openB, setOpenB] = useState(false);
  const [openC, setOpenC] = useState(false);

  return (
    <div>
      <button data-testid="opener-a" onClick={() => setOpenA(true)}>
        Open A
      </button>
      <PanelShell open={openA} onOpenChange={setOpenA} title="Shell A" testId="shell-a">
        <button data-testid="a-btn">A content</button>
        <button data-testid="opener-b" onClick={() => setOpenB(true)}>
          Open B
        </button>
        <PanelShell open={openB} onOpenChange={setOpenB} title="Shell B" testId="shell-b">
          <button data-testid="b-btn">B content</button>
          <button data-testid="opener-c" onClick={() => setOpenC(true)}>
            Open C
          </button>
          <DialogShell open={openC} onOpenChange={setOpenC} title="Shell C" testId="shell-c">
            <button data-testid="c-btn">C content</button>
          </DialogShell>
        </PanelShell>
      </PanelShell>
    </div>
  );
}

describe("three-deep stack (GG-6/GG-18/GG-19 combined)", () => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
    resetKeymapForTests();
  });

  it("push 3 in order, and the topmost owns Tab focus at every depth", async () => {
    const user = userEvent.setup();
    render(<ThreeDeepHarness />);

    await user.click(screen.getByTestId("opener-a"));
    const shellA = await screen.findByTestId("shell-a");
    expect(useLayerStack.getState().layers.map((l) => l.band)).toEqual(["panel"]);
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(shellA.contains(document.activeElement)).toBe(true);
    }

    await user.click(screen.getByTestId("opener-b"));
    const shellB = await screen.findByTestId("shell-b");
    expect(useLayerStack.getState().layers.map((l) => l.band)).toEqual(["panel", "panel"]);
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      // The topmost (B) owns focus now — A's own controls are inert (GG-18), even though A is
      // still mounted and visible underneath.
      expect(shellB.contains(document.activeElement)).toBe(true);
    }

    await user.click(screen.getByTestId("opener-c"));
    const shellC = await screen.findByTestId("shell-c");
    expect(useLayerStack.getState().layers.map((l) => l.band)).toEqual(["panel", "panel", "dialog"]);
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(shellC.contains(document.activeElement)).toBe(true);
    }
  });

  it("pop 3 via Esc, one level at a time, restoring focus back down the stack each time", async () => {
    const user = userEvent.setup();
    render(<ThreeDeepHarness />);

    const openerA = screen.getByTestId("opener-a");
    openerA.focus();
    await user.click(openerA);
    await screen.findByTestId("shell-a");

    const openerB = screen.getByTestId("opener-b");
    openerB.focus();
    await user.click(openerB);
    await screen.findByTestId("shell-b");

    const openerC = screen.getByTestId("opener-c");
    openerC.focus();
    await user.click(openerC);
    await screen.findByTestId("shell-c");
    expect(useLayerStack.getState().layers).toHaveLength(3);

    // Pop 1: C closes, B (and its "Open C" opener) is what's left on top.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("shell-c")).not.toBeInTheDocument());
    expect(useLayerStack.getState().layers).toHaveLength(2);
    expect(screen.getByTestId("shell-b")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(openerC));

    // Pop 2: B closes, A is what's left.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("shell-b")).not.toBeInTheDocument());
    expect(useLayerStack.getState().layers).toHaveLength(1);
    expect(screen.getByTestId("shell-a")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(openerB));

    // Pop 3: A closes, the stack is empty, focus is back at the very first opener.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("shell-a")).not.toBeInTheDocument());
    expect(useLayerStack.getState().layers).toEqual([]);
    await waitFor(() => expect(document.activeElement).toBe(openerA));
  });
});
