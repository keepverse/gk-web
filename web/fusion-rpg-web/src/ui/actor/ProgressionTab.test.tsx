import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PLAYER_PENDING } from "@/contract/adapt";
import { known, pendingWithReason } from "@/contract/pending";
import type { ActorView } from "@/contract/types";
import { ProgressionTab } from "./ProgressionTab";

const mutateAsync = vi.fn();

const aptitudesData = {
  theta: 100,
  budget: 300,
  shares: { Might: 12, Fortitude: 8, Agility: 5 }
};

let currentData: typeof aptitudesData | undefined = aptitudesData;

vi.mock("@/lib/bus", () => ({
  usePlayers: () => ({ data: { currentPlayerId: 1 } }),
  useAptitudes: () => ({ data: currentData, isLoading: currentData === undefined }),
  useSaveAptitudes: () => ({ mutateAsync, isPending: false })
}));

function actorWith(xpToNext: ActorView["xpToNext"]): ActorView {
  return {
    instanceId: "a1",
    playerId: 1,
    side: "plant",
    typeId: 3,
    displayName: known("Emberling"),
    phase: "ActiveBound",
    level: 14,
    xp: 2140,
    xpToNext,
    revision: 1,
    channelSummary: pendingWithReason(PLAYER_PENDING.channelSummary),
    elementTyping: pendingWithReason(PLAYER_PENDING.elementTyping),
    shieldStack: pendingWithReason(PLAYER_PENDING.shieldStack),
    equipSlots: pendingWithReason(PLAYER_PENDING.equipSlots)
  };
}

describe("ProgressionTab", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    currentData = aptitudesData;
  });

  it("always shows the real level and raw xp count", () => {
    render(
      <MemoryRouter>
        <ProgressionTab data={actorWith(pendingWithReason(PLAYER_PENDING.xpToNext))} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Level 14/)).toBeInTheDocument();
    expect(screen.getByTestId("progression-xp-raw")).toHaveTextContent("2140");
  });

  it("shows the honest pending note when xpToNext is pending (today's real state) instead of a fabricated bar", () => {
    render(
      <MemoryRouter>
        <ProgressionTab data={actorWith(pendingWithReason(PLAYER_PENDING.xpToNext))} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("progression-xp-pending")).toBeInTheDocument();
  });

  it("shows a real progress readout once xpToNext is known (future-proofing)", () => {
    render(
      <MemoryRouter>
        <ProgressionTab data={actorWith(known(960))} />
      </MemoryRouter>
    );
    expect(screen.queryByTestId("progression-xp-pending")).not.toBeInTheDocument();
    expect(screen.getByText(/2140.*3100/)).toBeInTheDocument();
  });

  it("renders aptitude ids straight from the mocked server response, not a hardcoded list", () => {
    render(
      <MemoryRouter>
        <ProgressionTab data={actorWith(pendingWithReason("x"))} />
      </MemoryRouter>
    );
    for (const id of Object.keys(aptitudesData.shares)) {
      expect((screen.getByTestId(`aptitude-input-${id}`) as HTMLInputElement).value).toBe(String(aptitudesData.shares[id as keyof typeof aptitudesData.shares]));
    }
  });

  it("save is disabled until dirty, and calls the same mutation AptitudesPage.tsx uses", () => {
    render(
      <MemoryRouter>
        <ProgressionTab data={actorWith(pendingWithReason("x"))} />
      </MemoryRouter>
    );
    const save = screen.getByTestId("aptitudes-save");
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByTestId("aptitude-input-Might"), { target: { value: "50" } });
    expect(save).not.toBeDisabled();

    fireEvent.click(save);
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ playerId: 1, shares: expect.objectContaining({ Might: 50 }) }));
  });

  it("over-budget disables save without clamping the input (PS-8)", () => {
    render(
      <MemoryRouter>
        <ProgressionTab data={actorWith(pendingWithReason("x"))} />
      </MemoryRouter>
    );
    const might = screen.getByTestId("aptitude-input-Might");
    fireEvent.change(might, { target: { value: "301" } });
    expect(screen.getByTestId("aptitudes-save")).toBeDisabled();
    expect((screen.getByTestId("aptitude-input-Might") as HTMLInputElement).value).toBe("301");
  });
});
