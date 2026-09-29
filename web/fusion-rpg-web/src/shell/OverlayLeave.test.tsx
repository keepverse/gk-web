import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverlayLeave } from "./OverlayLeave";
import { postOverlayLeave } from "@/lib/bus";

vi.mock("@/lib/bus", () => ({
  postOverlayLeave: vi.fn().mockResolvedValue({ ok: true })
}));

const mockedLeave = vi.mocked(postOverlayLeave);

/**
 * rift-gate overlay-hide: the page's Leave control.
 *
 * Two contracts matter here, and both are about what it does NOT do:
 *  - it is offered only when the host marked the visit as embedded (honest absence otherwise); and
 *  - pressing it asks the host to close the window and touches NO story state.
 */
describe("OverlayLeave — the page's close control", () => {
  beforeEach(() => {
    mockedLeave.mockClear();
    window.history.replaceState({}, "", "/");
  });

  it("is not offered in a plain browser visit (no embed marker)", () => {
    window.history.replaceState({}, "", "/#/sanctum");
    render(<OverlayLeave />);
    expect(screen.queryByTestId("overlay-leave")).toBeNull();
  });

  it("is offered when the visit is embedded", () => {
    window.history.replaceState({}, "", "/?embed=1#/sanctum");
    render(<OverlayLeave />);
    expect(screen.getByTestId("overlay-leave")).toBeTruthy();
  });

  it("asks the host to close the overlay when pressed", async () => {
    window.history.replaceState({}, "", "/?embed=1#/sanctum");
    render(<OverlayLeave />);
    await userEvent.click(screen.getByTestId("overlay-leave"));
    await waitFor(() => expect(mockedLeave).toHaveBeenCalledTimes(1));
  });

  it("never acknowledges the story — hiding is not finishing the prologue", async () => {
    // The leave path has no story call at all: it only asks the host to close. This asserts the
    // module surface, so a future edit that reaches for an onboarding ack fails here.
    const module = await import("./OverlayLeave");
    const source = module.OverlayLeave.toString();
    expect(source).not.toMatch(/acknowledge|Akacknowledge|Onboarding|story/i);

    window.history.replaceState({}, "", "/?embed=1#/sanctum");
    render(<OverlayLeave />);
    await userEvent.click(screen.getByTestId("overlay-leave"));
    await waitFor(() => expect(mockedLeave).toHaveBeenCalledTimes(1));
  });

  it("stays usable when the request fails — the host keys remain the way out", async () => {
    mockedLeave.mockRejectedValueOnce(new Error("server down"));
    window.history.replaceState({}, "", "/?embed=1#/sanctum");
    render(<OverlayLeave />);
    await userEvent.click(screen.getByTestId("overlay-leave"));
    await waitFor(() => expect(mockedLeave).toHaveBeenCalledTimes(1));
    // Still rendered: a failed ask must not remove the control or crash the shell.
    expect(screen.getByTestId("overlay-leave")).toBeTruthy();
  });
});
