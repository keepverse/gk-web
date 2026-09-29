import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommanderSheetFooter } from "./CommanderSheetFooter";

describe("CommanderSheetFooter", () => {
  it("disables Set default when the commander is already default", () => {
    render(
      <CommanderSheetFooter
        isDefault
        setDefaultPending={false}
        onClose={vi.fn()}
        onSetDefault={vi.fn()}
        onDefendLawn={vi.fn()}
        onOpenCommandersList={vi.fn()}
      />
    );
    expect(screen.getByTestId("commander-sheet-set-default")).toBeDisabled();
  });

  it("fires footer callbacks", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSetDefault = vi.fn();
    const onDefendLawn = vi.fn();
    const onOpenCommandersList = vi.fn();
    render(
      <CommanderSheetFooter
        isDefault={false}
        setDefaultPending={false}
        onClose={onClose}
        onSetDefault={onSetDefault}
        onDefendLawn={onDefendLawn}
        onOpenCommandersList={onOpenCommandersList}
      />
    );

    await user.click(screen.getByTestId("commander-sheet-close"));
    await user.click(screen.getByTestId("commander-sheet-set-default"));
    await user.click(screen.getByTestId("commander-sheet-defend"));
    await user.click(screen.getByTestId("commander-sheet-change-in-list"));

    expect(onClose).toHaveBeenCalled();
    expect(onSetDefault).toHaveBeenCalled();
    expect(onDefendLawn).toHaveBeenCalled();
    expect(onOpenCommandersList).toHaveBeenCalled();
  });

  it("labels Set default for next run when editsScope is nextRun", () => {
    render(
      <CommanderSheetFooter
        isDefault={false}
        setDefaultPending={false}
        editsScope="nextRun"
        onClose={vi.fn()}
        onSetDefault={vi.fn()}
        onDefendLawn={vi.fn()}
        onOpenCommandersList={vi.fn()}
      />
    );
    expect(screen.getByTestId("commander-sheet-set-default")).toHaveTextContent("Set default (next run)");
  });
});
