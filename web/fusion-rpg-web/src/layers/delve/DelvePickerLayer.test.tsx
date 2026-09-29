import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { DelvePickerLayer } from "./DelvePickerLayer";

function ControlledDelvePickerLayer() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div data-testid="stage-behind">Sanctum content</div>
      <DelvePickerLayer open={open} onOpenChange={setOpen} playerId={1} />
    </div>
  );
}

const mockUseUniqueActors = vi.fn();
const mockNewCorrelationId = vi.fn(() => "corr-1");

vi.mock("@/lib/bus", () => ({
  useUniqueActors: () => mockUseUniqueActors(),
  newCorrelationId: () => mockNewCorrelationId()
}));

const mockUseDelveDomainOffersFull = vi.fn();
const mockMutate = vi.fn();
const mockUseStartDelve = vi.fn();

vi.mock("@/lib/bus/delve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus/delve")>();
  return {
    ...actual,
    useDelveDomainOffersFull: () => mockUseDelveDomainOffersFull(),
    useStartDelve: () => mockUseStartDelve()
  };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const ROSTER_ITEMS = [
  { instanceId: "a-1", playerId: 1, side: "plant", typeId: 3, phase: "ActiveBound", level: 5, xp: 10, revision: 1 },
  { instanceId: "a-2", playerId: 1, side: "plant", typeId: 4, phase: "Retired", level: 8, xp: 40, revision: 1 }
];

const SEALED_OFFER = {
  domainId: "domain.sealed-001",
  name: "The Locked Fen",
  flavor: "A wet place, barred.",
  climate: "wet",
  entranceLabel: "Very hard",
  entryKey: "standing",
  sealed: true,
  resume: null,
  rungs: [],
  tailSteps: [],
  raidModes: [],
  bossName: "The Sunken King",
  cleared: [],
  provisionable: []
};

const IN_PROGRESS_OFFER = {
  domainId: "domain.active-001",
  name: "The Live Fen",
  flavor: "Already under way.",
  climate: "wet",
  entranceLabel: "Hard",
  entryKey: "standing",
  sealed: false,
  resume: { delveId: 42 },
  rungs: [],
  tailSteps: [],
  raidModes: [],
  bossName: "The Sunken King",
  cleared: [],
  provisionable: []
};

const OPEN_OFFER = {
  domainId: "domain.fire-001",
  name: "The Ember Fen",
  flavor: "A hot, dry place.",
  climate: "fire",
  entranceLabel: "Very hard",
  entryKey: "single-descent",
  sealed: false,
  resume: null,
  rungs: [
    { kind: "rung" as const, rungId: "r-1", label: "Very hard", bandName: "Deep", oathOffered: true, permadeath: true }
  ],
  tailSteps: [],
  raidModes: ["solo", "pair"],
  bossName: "The Ember King",
  cleared: [],
  provisionable: []
};

function setup(offers: unknown[]) {
  mockUseDelveDomainOffersFull.mockReturnValue({ data: offers, isLoading: false, isError: false });
  mockUseUniqueActors.mockReturnValue({ data: { items: ROSTER_ITEMS }, isLoading: false });
  mockUseStartDelve.mockReturnValue({ mutate: mockMutate, isPending: false });
}

describe("DelvePickerLayer (D5.8, spec-delve-stage.md §7 'Descent picker' row)", () => {
  // Every mock here is module-scoped (vi.mock hoists), so a stale mockMutate.mock.calls[0] from an
  // earlier test's already-unmounted render would otherwise leak into a later test that reads it —
  // real, caught bug: the refusal-message test below was reading the "same body" test's own callbacks.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state distinct from empty", () => {
    mockUseDelveDomainOffersFull.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    mockUseUniqueActors.mockReturnValue({ data: undefined, isLoading: true });
    mockUseStartDelve.mockReturnValue({ mutate: mockMutate, isPending: false });
    renderWithProviders(<DelvePickerLayer open onOpenChange={() => {}} playerId={1} />);
    expect(screen.getByTestId("delve-picker-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("delve-picker-empty")).not.toBeInTheDocument();
  });

  it("shows an error state with a retry, distinct from empty", async () => {
    const refetch = vi.fn();
    mockUseDelveDomainOffersFull.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    mockUseUniqueActors.mockReturnValue({ data: { items: [] }, isLoading: false });
    mockUseStartDelve.mockReturnValue({ mutate: mockMutate, isPending: false });
    const user = userEvent.setup();
    renderWithProviders(<DelvePickerLayer open onOpenChange={() => {}} playerId={1} />);
    expect(screen.getByTestId("delve-picker-error")).toBeInTheDocument();
    await user.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("The locked door is visible, never hidden — an empty offer list renders an honest empty state, not a blank panel", () => {
    setup([]);
    renderWithProviders(<DelvePickerLayer open onOpenChange={() => {}} playerId={1} />);
    expect(screen.getByTestId("delve-picker-empty")).toBeInTheDocument();
    expect(screen.getByText("No domains found yet")).toBeInTheDocument();
  });

  it("a sealed domain renders 'Closed to you' with no Descend control at all (§10 row 2)", () => {
    setup([SEALED_OFFER]);
    renderWithProviders(<DelvePickerLayer open onOpenChange={() => {}} playerId={1} />);
    expect(screen.getByTestId("delve-picker-domain-sealed")).toHaveTextContent("Closed to you");
    expect(screen.queryByTestId("delve-picker-descend")).not.toBeInTheDocument();
  });

  it("an in-progress domain renders 'In progress' with a Return action instead of Descend, and Return navigates to the real delve route (§10 row 3)", async () => {
    setup([IN_PROGRESS_OFFER]);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DelvePickerLayer open onOpenChange={onOpenChange} playerId={1} />);
    expect(screen.getByTestId("delve-picker-domain-in-progress")).toHaveTextContent("In progress");
    await user.click(screen.getByTestId("delve-picker-domain-return"));
    expect(mockNavigate).toHaveBeenCalledWith("/delve/42");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("an open domain expands into a real rung/raid-mode/party builder on click, sourced from the real offer shape", async () => {
    setup([OPEN_OFFER]);
    const user = userEvent.setup();
    renderWithProviders(<DelvePickerLayer open onOpenChange={() => {}} playerId={1} />);
    expect(screen.queryByTestId("delve-picker-domain-builder")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("delve-picker-domain-toggle"));
    expect(screen.getByTestId("delve-picker-domain-builder")).toBeInTheDocument();
    expect(screen.getByTestId("delve-picker-rung-select")).toHaveTextContent("Very hard — Deep");
    expect(screen.getByTestId("delve-picker-raid-mode-select")).toBeInTheDocument();
    // A Fallen (Retired) roster member's checkbox is disabled with a reason (GG-55); an ActiveBound one is not.
    expect(screen.getByTestId("delve-picker-member-a-1")).toBeEnabled();
    expect(screen.getByTestId("delve-picker-member-a-2")).toBeDisabled();
    expect(screen.getByTestId("delve-picker-member-a-2")).toHaveAttribute("title");
    // provisionable[] is real but always empty in production today (D4.16) — the honest empty state.
    expect(screen.getByTestId("delve-picker-provisioning-empty")).toBeInTheDocument();
  });

  it("Descend is disabled with a reason until a rung, a raid mode, and at least one member are chosen", async () => {
    setup([OPEN_OFFER]);
    const user = userEvent.setup();
    renderWithProviders(<DelvePickerLayer open onOpenChange={() => {}} playerId={1} />);
    await user.click(screen.getByTestId("delve-picker-domain-toggle"));

    const descendBtn = screen.getByTestId("delve-picker-descend");
    expect(descendBtn).toBeDisabled();
    expect(descendBtn).toHaveAttribute("title", "Choose a rung first.");

    await user.selectOptions(screen.getByTestId("delve-picker-rung-select"), "rung:r-1");
    expect(descendBtn).toBeDisabled();
    expect(descendBtn).toHaveAttribute("title", "Choose at least one creature first.");

    await user.click(screen.getByTestId("delve-picker-member-a-1"));
    expect(descendBtn).toBeEnabled();

    await user.click(descendBtn);
    expect(screen.getByTestId("descend-confirm")).toBeInTheDocument();
    // A single-descent, oathOffered rung — the Oath section must be showing in the confirm.
    expect(screen.getByTestId("descend-confirm-oath")).toBeInTheDocument();
  });

  it("The_picker_and_the_map_door_post_the_same_body — confirming posts the real DelveStartRequestBody shape through the shared mutation", async () => {
    setup([OPEN_OFFER]);
    const user = userEvent.setup();
    renderWithProviders(<DelvePickerLayer open onOpenChange={() => {}} playerId={1} />);

    await user.click(screen.getByTestId("delve-picker-domain-toggle"));
    await user.selectOptions(screen.getByTestId("delve-picker-rung-select"), "rung:r-1");
    await user.click(screen.getByTestId("delve-picker-member-a-1"));
    await user.click(screen.getByTestId("delve-picker-descend"));
    await user.click(screen.getByTestId("descend-confirm-oath-checkbox"));
    await user.click(screen.getByTestId("descend-confirm-confirm"));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [body, callbacks] = mockMutate.mock.calls[0]!;
    expect(body).toEqual({
      playerId: 1,
      correlationId: "corr-1",
      domainId: "domain.fire-001",
      parentWorldId: null,
      rungIdOrTailLabel: "r-1",
      oath: true,
      raidMode: "solo",
      memberInstanceIds: ["a-1"],
      carryIn: []
    });

    // onSuccess navigates to the real route and closes the layer.
    act(() => callbacks.onSuccess({ delveId: "9001", worldId: "w-9" }));
    expect(mockNavigate).toHaveBeenCalledWith("/delve/9001");
  });

  it("a refused attempt shows the translated refusal message, never the raw rule id", async () => {
    setup([{ ...OPEN_OFFER, rungs: [{ ...OPEN_OFFER.rungs[0]!, oathOffered: false, permadeath: false }] }]);
    const user = userEvent.setup();
    renderWithProviders(<DelvePickerLayer open onOpenChange={() => {}} playerId={1} />);

    await user.click(screen.getByTestId("delve-picker-domain-toggle"));
    await user.selectOptions(screen.getByTestId("delve-picker-rung-select"), "rung:r-1");
    await user.click(screen.getByTestId("delve-picker-member-a-1"));
    await user.click(screen.getByTestId("delve-picker-descend"));
    await user.click(screen.getByTestId("descend-confirm-confirm"));

    const [, callbacks] = mockMutate.mock.calls[0]!;
    act(() => callbacks.onError(new Error("domain.not-found")));

    await waitFor(() =>
      expect(screen.getByTestId("descend-confirm-error")).toHaveTextContent("That domain isn't open to you anymore.")
    );
  });

  it("Esc closes the layer without unmounting whatever is behind it", async () => {
    const user = userEvent.setup();
    setup([]);
    renderWithProviders(<ControlledDelvePickerLayer />, { withGlobalKeys: true });
    expect(screen.getByTestId("delve-picker-layer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("delve-picker-layer")).not.toBeInTheDocument());
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });
});
