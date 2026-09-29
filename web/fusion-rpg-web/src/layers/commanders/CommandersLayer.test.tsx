import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CommandersLayer } from "./CommandersLayer";

function ControlledCommandersLayer() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div data-testid="stage-behind">Sanctum content</div>
      <CommandersLayer open={open} onOpenChange={setOpen} playerId={1} selectedId={null} onSelect={() => {}} />
    </div>
  );
}

const listView = {
  defaultLawnCommanderId: "commander:dave",
  commanders: [
    {
      id: "commander:dave",
      displayName: "Crazy Dave",
      isDefault: true,
      activeAuraId: "Might",
      activeAuraName: "Might",
      locationStub: null,
      legionStub: null
    }
  ]
};

const mockUseCommanders = vi.fn();
const mockUseSetDefaultCommander = vi.fn();

vi.mock("@/lib/bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus")>();
  return {
    ...actual,
    useCommanders: () => mockUseCommanders(),
    useSetDefaultCommander: () => mockUseSetDefaultCommander()
  };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe("CommandersLayer (commander-surface P3)", () => {
  it("shows a loading state while the query is in flight", () => {
    mockUseCommanders.mockReturnValue({ isLoading: true, data: undefined });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderWithProviders(<CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("commanders-loading")).toBeInTheDocument();
  });

  it("shows an error state with a retry", async () => {
    const refetch = vi.fn();
    mockUseCommanders.mockReturnValue({ isError: true, data: undefined, refetch });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderWithProviders(<CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("commanders-error")).toBeInTheDocument();
    await user.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows an empty state when the roster is empty", () => {
    mockUseCommanders.mockReturnValue({ data: { defaultLawnCommanderId: "commander:dave", commanders: [] } });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderWithProviders(<CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("No commanders yet")).toBeInTheDocument();
  });

  it("renders Dave with default badge and Defend the lawn navigates without a picker", async () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderWithProviders(<CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("commanders-row-commander-dave")).toBeInTheDocument();
    expect(screen.getByTestId("commanders-default-badge-commander-dave")).toBeInTheDocument();
    await user.click(screen.getByTestId("commanders-defend"));
    expect(mockNavigate).toHaveBeenCalledWith("/lawn");
  });

  it("Set default POSTs the selected commander", async () => {
    mockUseCommanders.mockReturnValue({
      data: {
        defaultLawnCommanderId: "commander:dave",
        commanders: [
          listView.commanders[0]!,
          {
            id: "commander:penny",
            displayName: "Penny",
            isDefault: false,
            activeAuraId: null,
            activeAuraName: null,
            locationStub: null,
            legionStub: null
          }
        ]
      }
    });
    const mutateAsync = vi.fn().mockResolvedValue({ defaultLawnCommanderId: "commander:penny" });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderWithProviders(<CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    await user.click(screen.getByTestId("commanders-row-commander-penny"));
    await user.click(screen.getByTestId("commanders-set-default"));
    expect(mutateAsync).toHaveBeenCalledWith("commander:penny");
  });

  it("selectedId from URL opens the commander sheet without clicking Open sheet", () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderWithProviders(
      <CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId="commander:dave" onSelect={() => {}} />
    );
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
  });

  it("selectedId change after mount opens the commander sheet", () => {
    mockUseCommanders.mockReturnValue({
      data: {
        defaultLawnCommanderId: "commander:dave",
        commanders: [
          listView.commanders[0]!,
          {
            id: "commander:penny",
            displayName: "Penny",
            isDefault: false,
            activeAuraId: null,
            activeAuraName: null,
            locationStub: null,
            legionStub: null
          }
        ]
      }
    });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const { rerender } = renderWithProviders(
      <CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />
    );
    expect(screen.queryByTestId("actor-panel")).not.toBeInTheDocument();
    rerender(
      <CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId="commander:penny" onSelect={() => {}} />
    );
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
  });

  it("Open sheet works after closing the sheet while selectedId stays set", async () => {
    mockUseCommanders.mockReturnValue({
      data: {
        defaultLawnCommanderId: "commander:dave",
        commanders: [
          listView.commanders[0]!,
          {
            id: "commander:penny",
            displayName: "Penny",
            isDefault: false,
            activeAuraId: null,
            activeAuraName: null,
            locationStub: null,
            legionStub: null
          }
        ]
      }
    });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderWithProviders(
      <CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId="commander:penny" onSelect={() => {}} />
    );
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
    await user.click(screen.getByTestId("commander-sheet-close"));
    await waitFor(() => expect(screen.queryByTestId("actor-panel")).not.toBeInTheDocument());
    await user.click(screen.getByTestId("commanders-open-sheet"));
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
  });

  it("Open sheet shows ActorPanel and Set default POSTs from the sheet footer", async () => {
    mockUseCommanders.mockReturnValue({
      data: {
        defaultLawnCommanderId: "commander:dave",
        commanders: [
          listView.commanders[0]!,
          {
            id: "commander:penny",
            displayName: "Penny",
            isDefault: false,
            activeAuraId: null,
            activeAuraName: null,
            locationStub: null,
            legionStub: null
          }
        ]
      }
    });
    const mutateAsync = vi.fn().mockResolvedValue({ defaultLawnCommanderId: "commander:penny" });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderWithProviders(<CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    await user.click(screen.getByTestId("commanders-row-commander-penny"));
    await user.click(screen.getByTestId("commanders-open-sheet"));
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
    await user.click(screen.getByTestId("commander-sheet-set-default"));
    expect(mutateAsync).toHaveBeenCalledWith("commander:penny");
  });

  it("Esc closes it without unmounting whatever is behind it", async () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderWithProviders(<ControlledCommandersLayer />, { withGlobalKeys: true });
    expect(screen.getByTestId("commanders-layer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("commanders-layer")).not.toBeInTheDocument());
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });

  it("closing the layer dismisses an open commander sheet", async () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />
    );
    await user.click(screen.getByTestId("commanders-row-commander-dave"));
    await user.click(screen.getByTestId("commanders-open-sheet"));
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
    rerender(<CommandersLayer open={false} onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    await waitFor(() => expect(screen.queryByTestId("commanders-layer")).not.toBeInTheDocument());
    expect(screen.queryByTestId("actor-panel")).not.toBeInTheDocument();
  });

  it("Esc with sheet open closes the sheet but keeps the Commanders layer", async () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderWithProviders(<CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />, {
      withGlobalKeys: true
    });
    await user.click(screen.getByTestId("commanders-row-commander-dave"));
    await user.click(screen.getByTestId("commanders-open-sheet"));
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("actor-panel")).not.toBeInTheDocument());
    expect(screen.getByTestId("commanders-layer")).toBeInTheDocument();
  });

  it("Defend from the sheet footer navigates to the lawn", async () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    mockUseSetDefaultCommander.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderWithProviders(<CommandersLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    await user.click(screen.getByTestId("commanders-row-commander-dave"));
    await user.click(screen.getByTestId("commanders-open-sheet"));
    await user.click(screen.getByTestId("commander-sheet-defend"));
    expect(mockNavigate).toHaveBeenCalledWith("/lawn");
  });
});
