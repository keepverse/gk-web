import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registryFor } from "@/i18n/leadNames";
import { OnboardingReveal } from "./OnboardingReveal";

const mockUseOnboarding = vi.fn();
const mockUseClaim = vi.fn();
vi.mock("@/lib/bus", () => ({
  useOnboarding: () => mockUseOnboarding(),
  useClaimOnboarding: () => mockUseClaim()
}));

describe("OnboardingReveal", () => {
  beforeEach(() => {
    mockUseClaim.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
  });

  it("shows the current earned checkpoint and acknowledges it", async () => {
    const mutateAsync = vi.fn();
    mockUseClaim.mockReturnValue({ isPending: false, mutateAsync });
    mockUseOnboarding.mockReturnValue({ isLoading: false, isError: false, data: {
      playerId: 1, playerLevel: 1, revision: 1,
      checkpoints: [{ checkpointId: "first-win-dave", state: "earned", claimedUtc: null, earnedRunId: 2,
        rewardRef: "fact:2", payloadJson: "{}", earnedUtc: "now", revision: 1 }]
    }});
    const user = userEvent.setup();
    render(<OnboardingReveal playerId={1} onOpenCommanders={vi.fn()} />);
    // The name and its article come from the registry (plan D2), so the expectation is built from the
    // registry too - a rename stays a one-row edit and this test follows it.
    const keeper = registryFor("en").names.lead_summoner;
    const article = keeper.article === "definite" ? "The " : "";
    expect(screen.getByText(`${article}${keeper.display} joins your side`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(mutateAsync).toHaveBeenCalledWith("first-win-dave");
  });

  it("renders nothing once the queue is claimed", () => {
    mockUseOnboarding.mockReturnValue({ isLoading: false, isError: false, data: {
      playerId: 1, playerLevel: 1, revision: 2,
      checkpoints: [{ checkpointId: "first-win-dave", state: "claimed", claimedUtc: "now", earnedRunId: 2,
        rewardRef: "fact:2", payloadJson: "{}", earnedUtc: "now", revision: 2 }]
    }});
    const { container } = render(<OnboardingReveal playerId={1} onOpenCommanders={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("explains why acknowledgement is disabled while it saves", () => {
    mockUseClaim.mockReturnValue({ isPending: true, mutateAsync: vi.fn() });
    mockUseOnboarding.mockReturnValue({ isLoading: false, isError: false, data: {
      playerId: 1, playerLevel: 1, revision: 1,
      checkpoints: [{ checkpointId: "first-win-dave", state: "earned", claimedUtc: null, earnedRunId: 2,
        rewardRef: "fact:2", payloadJson: "{}", earnedUtc: "now", revision: 1 }]
    }});
    render(<OnboardingReveal playerId={1} onOpenCommanders={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toHaveAttribute("title", "Saving reward…");
  });
});
