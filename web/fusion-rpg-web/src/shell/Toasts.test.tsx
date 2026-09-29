import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toasts } from "./Toasts";
import { useToastStack } from "./toastStack";

beforeEach(() => {
  useToastStack.getState().clear();
});

describe("Toasts", () => {
  it("renders nothing when the stack is empty", () => {
    render(<Toasts />);
    expect(screen.getByTestId("toast-stack")).toBeEmptyDOMElement();
  });

  it("renders a pushed toast's title and message", () => {
    useToastStack.getState().push({ tone: "bad", title: "Creature update failed", message: "Nothing changed." });
    render(<Toasts />);
    expect(screen.getByTestId("toast-title")).toHaveTextContent("Creature update failed");
    expect(screen.getByTestId("toast-message")).toHaveTextContent("Nothing changed.");
  });

  it("the stack container never blocks input, only the toasts themselves do", () => {
    useToastStack.getState().push({ tone: "ok", title: "Souls updated" });
    render(<Toasts />);
    expect(screen.getByTestId("toast-stack").className).toContain("pointer-events-none");
    const toastId = useToastStack.getState().toasts[0]!.id;
    expect(screen.getByTestId(`toast-${toastId}`).className).toContain("pointer-events-auto");
  });

  it("is band-toast, never a bespoke z-index", () => {
    render(<Toasts />);
    expect(screen.getByTestId("toast-stack").className).toContain("band-toast");
  });

  it("world-stage W84: a toast with an action renders a button that runs it and dismisses", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    useToastStack.getState().push({
      tone: "warn",
      title: "Ash Waste will release next turn",
      category: "loam.release",
      action: { label: "View sector", run }
    });
    render(<Toasts />);

    const action = screen.getByTestId("toast-action");
    expect(action).toHaveTextContent("View sector");
    await user.click(action);

    expect(run).toHaveBeenCalledTimes(1);
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });

  it("a toast without an action renders exactly as before — no action button at all", () => {
    useToastStack.getState().push({ tone: "ok", title: "Souls updated" });
    render(<Toasts />);
    expect(screen.queryByTestId("toast-action")).not.toBeInTheDocument();
  });

  it("world-stage W89: caps the visible stack at three, newest on top, the rest behind a count", () => {
    useToastStack.getState().push({ tone: "ok", title: "A" });
    useToastStack.getState().push({ tone: "ok", title: "B" });
    useToastStack.getState().push({ tone: "ok", title: "C" });
    useToastStack.getState().push({ tone: "ok", title: "D" });
    useToastStack.getState().push({ tone: "ok", title: "E" });
    render(<Toasts />);

    const titles = screen.getAllByTestId("toast-title").map((el) => el.textContent);
    expect(titles).toEqual(["E", "D", "C"]);
    expect(screen.getByTestId("toast-hidden-count")).toHaveTextContent("+2 more");
  });

  it("no hidden-count badge at or under the cap", () => {
    useToastStack.getState().push({ tone: "ok", title: "A" });
    useToastStack.getState().push({ tone: "ok", title: "B" });
    render(<Toasts />);
    expect(screen.queryByTestId("toast-hidden-count")).not.toBeInTheDocument();
  });
});
