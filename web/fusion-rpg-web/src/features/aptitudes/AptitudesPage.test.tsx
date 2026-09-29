import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AptitudesPage } from "./AptitudesPage";

const mutateAsync = vi.fn();

const aptitudesData = {
  theta: 100,
  budget: 300,
  spent: 0,
  withinBudget: true,
  shares: {
    Might: 0,
    Fortitude: 0,
    Vigor: 0,
    Onslaught: 0,
    Agility: 0,
    Composure: 0,
    Pierce: 0,
    Focus: 0,
    Bulwark: 0,
    Retribution: 0,
    Precision: 0,
    Ferocity: 0
  }
};

let currentData: typeof aptitudesData | undefined = aptitudesData;

vi.mock("@/lib/bus", () => ({
  usePlayers: () => ({ data: { currentPlayerId: 1 } }),
  useAptitudes: () => ({ data: currentData, isLoading: currentData === undefined }),
  useSaveAptitudes: () => ({ mutateAsync, isPending: false })
}));

describe("AptitudesPage smoke", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    currentData = aptitudesData;
  });

  it("shows a loading state when data has not arrived yet", () => {
    currentData = undefined;
    render(
      <MemoryRouter>
        <AptitudesPage />
      </MemoryRouter>
    );
    expect(screen.getByTestId("aptitudes-loading")).toBeInTheDocument();
  });

  it("renders all twelve aptitude inputs at their server-supplied values", () => {
    render(
      <MemoryRouter>
        <AptitudesPage />
      </MemoryRouter>
    );
    for (const id of Object.keys(aptitudesData.shares)) {
      const input = screen.getByTestId(`aptitude-input-${id}`) as HTMLInputElement;
      expect(input.value).toBe("0");
    }
  });

  it("save is disabled until the draft actually changes", () => {
    render(
      <MemoryRouter>
        <AptitudesPage />
      </MemoryRouter>
    );
    expect(screen.getByTestId("aptitudes-save")).toBeDisabled();
  });

  it("editing a value enables save, and over-budget disables it again without clamping the input", () => {
    render(
      <MemoryRouter>
        <AptitudesPage />
      </MemoryRouter>
    );
    const might = screen.getByTestId("aptitude-input-Might");
    fireEvent.change(might, { target: { value: "300" } });
    expect(screen.getByTestId("aptitudes-save")).not.toBeDisabled();

    fireEvent.change(might, { target: { value: "301" } });
    expect(screen.getByTestId("aptitudes-save")).toBeDisabled();
    // PS-8: never silently clamped back to the budget -- the input itself still shows what was typed.
    expect((screen.getByTestId("aptitude-input-Might") as HTMLInputElement).value).toBe("301");
  });

  it("clicking save calls the mutation with the edited draft", async () => {
    render(
      <MemoryRouter>
        <AptitudesPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByTestId("aptitude-input-Might"), { target: { value: "50" } });
    fireEvent.click(screen.getByTestId("aptitudes-save"));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playerId: 1, shares: expect.objectContaining({ Might: 50 }) })
    );
  });
});
