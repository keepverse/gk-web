import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommanderActionBar } from "./CommanderActionBar";

describe("CommanderActionBar", () => {
  it("always paints nine slots; empty corpus stays locked-visible", () => {
    render(<CommanderActionBar slots={[]} armedId={null} onArm={vi.fn()} />);
    for (let i = 1; i <= 9; i++) {
      expect(screen.getByTestId(`commander-action-slot-${i}`)).toHaveAttribute("data-locked", "true");
    }
  });

  it("arms an unlocked slot and ignores locked clicks", async () => {
    const onArm = vi.fn();
    const user = userEvent.setup();
    render(
      <CommanderActionBar
        slots={[
          {
            id: "order-a",
            slot: 1,
            name: "Rally",
            costLabel: "3 AP"
          }
        ]}
        onArm={onArm}
      />
    );
    await user.click(screen.getByTestId("commander-action-slot-1"));
    expect(onArm).toHaveBeenCalledWith(
      expect.objectContaining({ id: "order-a", slot: 1 })
    );
    await user.click(screen.getByTestId("commander-action-slot-2"));
    expect(onArm).toHaveBeenCalledTimes(1);
  });
});
