import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { DescendConfirm } from "./DescendConfirm";

const BASE_PROPS = {
  open: true,
  domainName: "The Fen",
  entryKindPhrase: "Open ground",
  rungLabel: "Very hard — Deep",
  raidModePhrase: "One band",
  memberCount: 2,
  requiresOath: false,
  permadeath: false,
  oathAccepted: false,
  onOathAcceptedChange: () => {},
  onConfirm: () => {},
  onCancel: () => {}
};

function ControlledOath(props: { requiresOath: boolean; permadeath: boolean; onConfirm: () => void }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <DescendConfirm
      {...BASE_PROPS}
      requiresOath={props.requiresOath}
      permadeath={props.permadeath}
      oathAccepted={accepted}
      onOathAcceptedChange={setAccepted}
      onConfirm={props.onConfirm}
    />
  );
}

describe("DescendConfirm (D5.8, spec-delve-stage.md §7 — 'Descent confirm (single-descent domains, and the Oath)')", () => {
  it("recaps the real chosen shape — domain, entry kind, rung, raid mode, party size — never a raw wire id", () => {
    render(<DescendConfirm {...BASE_PROPS} />);
    // DialogShell's own Dialog.Description defaults to the title text too (sr-only, when no subtitle
    // is given), so this asserts against the visible heading specifically, not any match.
    expect(screen.getByRole("heading", { name: "Descend into The Fen" })).toBeInTheDocument();
    const recap = screen.getByTestId("descend-confirm-recap");
    expect(recap).toHaveTextContent("Open ground");
    expect(recap).toHaveTextContent("Very hard — Deep");
    expect(recap).toHaveTextContent("One band");
    expect(recap).toHaveTextContent("2 creatures");
  });

  it("no Oath section when the chosen rung doesn't offer one, and Descend is enabled immediately", () => {
    render(<DescendConfirm {...BASE_PROPS} requiresOath={false} />);
    expect(screen.queryByTestId("descend-confirm-oath")).not.toBeInTheDocument();
    expect(screen.getByTestId("descend-confirm-confirm")).toBeEnabled();
  });

  it("a single-descent rung shows the Oath checkbox and Descend stays disabled — with a reason — until it's checked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ControlledOath requiresOath permadeath={false} onConfirm={onConfirm} />);

    const confirmBtn = screen.getByTestId("descend-confirm-confirm");
    expect(screen.getByTestId("descend-confirm-oath")).toBeInTheDocument();
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveAttribute("title", "Accept the Oath to descend");

    // A disabled control never fires its handler in a real browser, but this proves the *gate* itself
    // — not just the visual disabled state — actually withholds the decision: no test double is
    // wired to bypass the DOM's own disabled semantics here.
    await user.click(confirmBtn).catch(() => {});
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("descend-confirm-oath-checkbox"));
    expect(confirmBtn).toBeEnabled();
    await user.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("permadeath changes the Oath's own explanatory copy, but oathOffered alone is still what gates the button", () => {
    render(<DescendConfirm {...BASE_PROPS} requiresOath permadeath oathAccepted={false} />);
    expect(screen.getByTestId("descend-confirm-oath")).toHaveTextContent(/Fallen for good/);
    expect(screen.getByTestId("descend-confirm-confirm")).toBeDisabled();
  });

  it("shows the last refusal's own translated message, never a raw rule id", () => {
    render(<DescendConfirm {...BASE_PROPS} errorMessage="That domain isn't open to you anymore." />);
    expect(screen.getByTestId("descend-confirm-error")).toHaveTextContent("That domain isn't open to you anymore.");
  });

  it("Stay fires onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<DescendConfirm {...BASE_PROPS} onCancel={onCancel} />);
    await user.click(screen.getByTestId("descend-confirm-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape cancels when not busy — through the real global keymap, the single owner of Esc (GG-6), not a component-local listener", async () => {
    // DialogShell pushes onto the shared layer stack; Esc is only real when the app's own global
    // keymap (useGlobalKeys) is mounted to read that stack and dispatch to it — matching
    // ExpeditionsLayer.test.tsx's own identical precedent for a PanelShell-based layer.
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithProviders(<DescendConfirm {...BASE_PROPS} onCancel={onCancel} />, { withGlobalKeys: true });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it("busy disables Cancel and Confirm, each with a title reason (GG-55)", () => {
    render(<DescendConfirm {...BASE_PROPS} busy />);
    const confirmBtn = screen.getByTestId("descend-confirm-confirm");
    const cancelBtn = screen.getByTestId("descend-confirm-cancel");
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveAttribute("title");
    expect(cancelBtn).toBeDisabled();
    expect(cancelBtn).toHaveAttribute("title");
  });

  it("renders nothing when closed", () => {
    render(<DescendConfirm {...BASE_PROPS} open={false} />);
    expect(screen.queryByTestId("descend-confirm")).not.toBeInTheDocument();
  });
});
