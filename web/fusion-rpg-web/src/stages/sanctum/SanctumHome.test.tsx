import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SanctumHome } from "./SanctumHome";

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
vi.mock("@/lib/bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus")>();
  return { ...actual, useCommanders: () => mockUseCommanders() };
});

// D5.8 — the descent-door card's own lock signal. Defaulted here (module scope, not per-test) so the
// three pre-existing tests below — none of which know about the delve door — keep passing unmodified;
// only the new tests at the bottom override it.
const mockUseDelveDomainOffersFull = vi.fn();
mockUseDelveDomainOffersFull.mockReturnValue({ data: [] });
vi.mock("@/lib/bus/delve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus/delve")>();
  return { ...actual, useDelveDomainOffersFull: () => mockUseDelveDomainOffersFull() };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe("SanctumHome commander readout", () => {
  it("shows Leading line and Change commander opens the layer callback", async () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    const onOpenCommanders = vi.fn();
    const user = userEvent.setup();
    render(
      <SanctumHome
        playerId={1}
        actorStates={[]}
        onOpenCreatures={() => {}}
        onOpenCommanders={onOpenCommanders}
        returnedExpeditionCount={0}
        onOpenExpeditions={() => {}}
        onOpenDelvePicker={() => {}}
      />
    );
    expect(screen.getByTestId("sanctum-home-leading-line")).toHaveTextContent("Leading: Crazy Dave · Might");
    await user.click(screen.getByTestId("sanctum-home-change-commander"));
    expect(onOpenCommanders).toHaveBeenCalled();
  });

  it("shows error state instead of faking Dave when the list query fails", () => {
    mockUseCommanders.mockReturnValue({ isError: true, refetch: vi.fn() });
    render(
      <SanctumHome
        playerId={1}
        actorStates={[]}
        onOpenCreatures={() => {}}
        onOpenCommanders={() => {}}
        returnedExpeditionCount={0}
        onOpenExpeditions={() => {}}
        onOpenDelvePicker={() => {}}
      />
    );
    expect(screen.getByTestId("sanctum-home-leading-error")).toBeInTheDocument();
    expect(screen.queryByText(/Leading: Crazy Dave/)).not.toBeInTheDocument();
  });
});

describe("SanctumHome — the descent door (D5.8, spec-delve-stage.md §4)", () => {
  it("is always rendered, and locked with a reason when no domain has been found (GG-17 — never invisible, never present-but-dead)", () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    mockUseDelveDomainOffersFull.mockReturnValue({ data: [] });
    render(
      <SanctumHome
        playerId={1}
        actorStates={[]}
        onOpenCreatures={() => {}}
        onOpenCommanders={() => {}}
        returnedExpeditionCount={0}
        onOpenExpeditions={() => {}}
        onOpenDelvePicker={() => {}}
      />
    );
    const doorPanel = screen.getByTestId("sanctum-home-delve-door");
    expect(doorPanel).toBeInTheDocument();
    const lockedBtn = screen.getByTestId("sanctum-home-delve-door-locked");
    expect(lockedBtn).toBeDisabled();
    expect(lockedBtn).toHaveAttribute("title", "Unlocks once an expedition finds your first domain.");
    // GG-17: the reason is visible copy on the page, not merely a hover-only tooltip.
    expect(screen.getByTestId("sanctum-home-delve-door-locked-reason")).toHaveTextContent(
      "Unlocks once an expedition finds your first domain."
    );
    expect(screen.queryByTestId("sanctum-home-delve-door-open")).not.toBeInTheDocument();
  });

  it("unlocks once at least one domain has been found, and opens the picker via the real callback", async () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    mockUseDelveDomainOffersFull.mockReturnValue({ data: [{ domainId: "domain.fire-001" }] });
    const onOpenDelvePicker = vi.fn();
    const user = userEvent.setup();
    render(
      <SanctumHome
        playerId={1}
        actorStates={[]}
        onOpenCreatures={() => {}}
        onOpenCommanders={() => {}}
        returnedExpeditionCount={0}
        onOpenExpeditions={() => {}}
        onOpenDelvePicker={onOpenDelvePicker}
      />
    );
    expect(screen.queryByTestId("sanctum-home-delve-door-locked")).not.toBeInTheDocument();
    const openBtn = screen.getByTestId("sanctum-home-delve-door-open");
    expect(openBtn).toBeEnabled();
    await user.click(openBtn);
    expect(onOpenDelvePicker).toHaveBeenCalledTimes(1);
  });

  it("a still-loading offers query reads as locked, never as unlocked from stale/undefined data", () => {
    mockUseCommanders.mockReturnValue({ data: listView });
    mockUseDelveDomainOffersFull.mockReturnValue({ data: undefined, isLoading: true });
    render(
      <SanctumHome
        playerId={1}
        actorStates={[]}
        onOpenCreatures={() => {}}
        onOpenCommanders={() => {}}
        returnedExpeditionCount={0}
        onOpenExpeditions={() => {}}
        onOpenDelvePicker={() => {}}
      />
    );
    expect(screen.getByTestId("sanctum-home-delve-door-locked")).toBeDisabled();
  });
});
