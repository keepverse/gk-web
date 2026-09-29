import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DockShell } from "./DockShell";
import { useLayerStack } from "./layerStack";
import { resetKeymapForTests } from "./keymap";
import { useGlobalKeys } from "./useGlobalKeys";

function OpenerHarness() {
  useGlobalKeys();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button data-testid="opener" onClick={() => setOpen(true)}>
        Open
      </button>
      <DockShell
        open={open}
        onOpenChange={setOpen}
        title="Ember Hollow"
        testId="shell-under-test"
        footer={<button data-testid="footer-btn">Footer action</button>}
      >
        <button data-testid="body-btn-1">First</button>
        <button data-testid="body-btn-2">Second</button>
      </DockShell>
    </div>
  );
}

describe("DockShell — an edge-anchored band-2 shell (world-stage W56)", () => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
    resetKeymapForTests();
  });

  it("renders title, body and footer when open", () => {
    render(
      <DockShell open onOpenChange={() => {}} title="Ember Hollow" testId="t">
        Body content
      </DockShell>
    );
    expect(screen.getByTestId("t")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ember Hollow" })).toBeInTheDocument();
    expect(screen.getByTestId("t-body")).toHaveTextContent("Body content");
  });

  it("renders nothing when closed", () => {
    render(
      <DockShell open={false} onOpenChange={() => {}} title="Ember Hollow" testId="t">
        Body content
      </DockShell>
    );
    expect(screen.queryByTestId("t")).not.toBeInTheDocument();
  });

  it("registers itself on the shared LayerStack at band panel while open, and clears on close", async () => {
    const user = userEvent.setup();
    render(<OpenerHarness />);
    expect(useLayerStack.getState().layers).toEqual([]);

    await user.click(screen.getByTestId("opener"));
    await waitFor(() => expect(screen.getByTestId("shell-under-test")).toBeInTheDocument());
    expect(useLayerStack.getState().layers.map((l) => l.band)).toEqual(["panel"]);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("shell-under-test")).not.toBeInTheDocument());
    expect(useLayerStack.getState().layers).toEqual([]);
  });

  it("traps Tab focus inside the shell's own controls", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button data-testid="outside-sentinel">Outside</button>
        <OpenerHarness />
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
    render(<OpenerHarness />);
    const opener = screen.getByTestId("opener");

    opener.focus();
    await user.click(opener);
    await screen.findByTestId("shell-under-test");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("shell-under-test")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("docks beside the 92px rail, full height, at the declared 380px width — never over the rail", () => {
    render(
      <DockShell open onOpenChange={() => {}} title="Ember Hollow" testId="t">
        Body
      </DockShell>
    );
    const shell = screen.getByTestId("t");
    expect(shell.className).toContain("left-[92px]");
    expect(shell.className).toContain("w-[380px]");
    expect(shell.className).toContain("inset-y-0");
  });

  it("registers on the layer stack at band panel — the same GG-5 band-only stacking vocabulary PanelShell uses, no z-index", () => {
    render(
      <DockShell open onOpenChange={() => {}} title="Ember Hollow" testId="t">
        Body
      </DockShell>
    );
    expect(screen.getByTestId("t").className).toContain("band-panel");
    expect(screen.getByTestId("t").className).not.toMatch(/z-\[|z-(?:0|10|20|30|40|50)\b/);
  });

  it("renders no scrim/overlay — the map beside it stays visible and interactive by design", () => {
    render(
      <DockShell open onOpenChange={() => {}} title="Ember Hollow" testId="t">
        Body
      </DockShell>
    );
    expect(screen.queryByTestId("t-overlay")).not.toBeInTheDocument();
    expect(document.querySelector('[data-radix-dialog-overlay], [class*="overlay" i]')).toBeNull();
  });

  it("the body is the only part that scrolls — bounded per GG-61", () => {
    render(
      <DockShell open onOpenChange={() => {}} title="Ember Hollow" testId="t">
        Body
      </DockShell>
    );
    expect(screen.getByTestId("t-body").className).toContain("overflow-y-auto");
    expect(screen.getByTestId("t").className).toContain("overflow-hidden");
  });

  it("renders an explicit close (×) control — a dock has no scrim/click-away, so this restores the pointer-user affordance a modal gets for free", async () => {
    const user = userEvent.setup();
    render(<OpenerHarness />);
    await user.click(screen.getByTestId("opener"));
    await screen.findByTestId("shell-under-test");

    await user.click(screen.getByTestId("shell-under-test-close"));
    await waitFor(() => expect(screen.queryByTestId("shell-under-test")).not.toBeInTheDocument());
  });
});
