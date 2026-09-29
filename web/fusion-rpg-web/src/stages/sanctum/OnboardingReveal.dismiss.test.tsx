import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OnboardingReveal } from "./OnboardingReveal";

const mockUseOnboarding = vi.fn();
const mockUseClaim = vi.fn();
vi.mock("@/lib/bus", () => ({
  useOnboarding: () => mockUseOnboarding(),
  useClaimOnboarding: () => mockUseClaim()
}));

function earned() {
  mockUseClaim.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
  mockUseOnboarding.mockReturnValue({ isLoading: false, isError: false, data: {
    playerId: 1, playerLevel: 1, revision: 1,
    checkpoints: [{ checkpointId: "first-win-dave", state: "earned", claimedUtc: null, earnedRunId: 2,
      rewardRef: "fact:2", payloadJson: "{}", earnedUtc: "now", revision: 1 }]
  }});
}

describe("OnboardingReveal skip-dismiss (T26)", () => {
  it("skip hides the block without claiming", async () => {
    const mutateAsync = vi.fn();
    mockUseClaim.mockReturnValue({ isPending: false, mutateAsync });
    mockUseOnboarding.mockReturnValue({ isLoading: false, isError: false, data: {
      playerId: 1, playerLevel: 1, revision: 1,
      checkpoints: [{ checkpointId: "first-win-dave", state: "earned", claimedUtc: null, earnedRunId: 2,
        rewardRef: "fact:2", payloadJson: "{}", earnedUtc: "now", revision: 1 }]
    }});
    const user = userEvent.setup();
    const { container } = render(<OnboardingReveal playerId={1} onOpenCommanders={vi.fn()} />);
    // Skip is present on the one-beat reveal exactly like on every scene beat.
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(container).toBeEmptyDOMElement();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("renders through the shared pieces with no progress node (one-beat rule)", () => {
    earned();
    const { container } = render(<OnboardingReveal playerId={1} onOpenCommanders={vi.fn()} />);
    expect(container.querySelector(".story-dialogue-window__line")).not.toBeNull();
    expect(container.querySelector(".story-advance-control")).not.toBeNull();
    expect(container.querySelector(".story-scene-progress")).toBeNull();
  });
});
