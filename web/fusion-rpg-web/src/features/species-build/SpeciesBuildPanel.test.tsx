import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SpeciesBuildPanel } from "./SpeciesBuildPanel";

const respecMutateAsync = vi.fn();
const speciesRefetch = vi.fn();

const baseline = { Might: 500, Vigor: 300, Fortitude: 200 };

let speciesData:
  | {
      speciesId: string;
      level: number;
      budget: number;
      spent: number;
      withinBudget: boolean;
      hasOverride: boolean;
      shares: Record<string, number>;
      baseline: Record<string, number>;
    }
  | undefined;
let speciesIsError = false;

let priceData:
  | {
      speciesId: string;
      respecCount: number;
      priceResource: string;
      priceAmount: number;
      everRespecced: boolean;
      // respec-free-counter EP4.10/EP4.12
      freeRespecStock?: number;
      freeAvailable?: boolean;
    }
  | undefined;
let priceIsLoading = false;
let priceIsError = false;

vi.mock("@/lib/bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus")>();
  return {
    ...actual,
    useSpeciesAptitudes: () => ({
      data: speciesData,
      isLoading: speciesData === undefined && !speciesIsError,
      isError: speciesIsError,
      refetch: speciesRefetch
    }),
    useSpeciesRespecPrice: () => ({
      data: priceData,
      isLoading: priceIsLoading,
      isError: priceIsError
    }),
    useRespecSpecies: () => ({ mutateAsync: respecMutateAsync, isPending: false })
  };
});

vi.mock("@/lib/bus/creatures", () => ({
  newCorrelationId: () => "corr-fixed"
}));

vi.mock("@/lib/bus/aptitudePresets", () => ({
  probeAptitudePresetsApi: vi.fn(async () => true),
  useAptitudePresetActive: () => ({ data: { presetId: null }, isLoading: false }),
  useAptitudePresets: () => ({ data: [], isLoading: false }),
  useSaveAptitudePreset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAptitudePreset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAptitudePreset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useActivateAptitudePreset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  fetchAptitudePresetFavour: vi.fn(async () => ({})),
  materializeAptitudePreset: vi.fn()
}));

function freshState(overrides?: Partial<NonNullable<typeof speciesData>>) {
  return {
    speciesId: "fumeshroom",
    level: 21,
    budget: 1000,
    spent: 1000,
    withinBudget: true,
    hasOverride: false,
    shares: { ...baseline },
    baseline: { ...baseline },
    ...overrides
  };
}

describe("SpeciesBuildPanel", () => {
  beforeEach(() => {
    respecMutateAsync.mockReset();
    speciesRefetch.mockReset();
    speciesData = freshState();
    speciesIsError = false;
    priceData = {
      speciesId: "fumeshroom",
      respecCount: 0,
      priceResource: "Soul",
      priceAmount: 50,
      everRespecced: false
    };
    priceIsLoading = false;
    priceIsError = false;
    respecMutateAsync.mockImplementation(async (vars: { shares: Record<string, number> }) => ({
      speciesId: "fumeshroom",
      level: 21,
      priced: false,
      priceAmount: 0,
      respecCount: 0,
      soulBalance: 500,
      replay: false,
      shares: vars.shares
    }));
  });

  it("shows a loading state before the species data arrives", () => {
    speciesData = undefined;
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);
    expect(screen.getByTestId("species-build-loading")).toBeInTheDocument();
  });

  it("G6: a failed species query renders the error state (with retry), never a permanent loading spinner", () => {
    speciesData = undefined;
    speciesIsError = true;
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);

    expect(screen.getByTestId("species-build-error")).toBeInTheDocument();
    expect(screen.queryByTestId("species-build-loading")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(speciesRefetch).toHaveBeenCalledTimes(1);
  });

  it("renders the shipped baseline without an override", () => {
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);
    expect(screen.getByTestId("species-build-status")).toHaveTextContent("shipped build");
    expect((screen.getByTestId("species-build-input-Might") as HTMLInputElement).value).toBe("500");
  });

  it("renders an override honesty on species chrome", () => {
    speciesData = freshState({
      hasOverride: true,
      shares: { Might: 0, Vigor: 0, Fortitude: 1000 },
      baseline
    });
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);
    expect(screen.getByTestId("species-build-status")).toHaveTextContent("overridden");
    expect((screen.getByTestId("species-build-input-Might") as HTMLInputElement).value).toBe("0");
  });

  it("G5: a species with no build yet (budget 0, no override) renders honest empty-build copy", () => {
    speciesData = freshState({
      level: 1,
      budget: 0,
      spent: 0,
      withinBudget: true,
      hasOverride: false,
      shares: { Might: 0, Vigor: 0, Fortitude: 0 },
      baseline: { Might: 0, Vigor: 0, Fortitude: 0 }
    });
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);

    const status = screen.getByTestId("species-build-status");
    expect(status).toHaveTextContent(/hasn't grown a build yet/i);
    expect(status).not.toHaveTextContent("shipped build");

    expect(screen.getByTestId("species-build-save")).toBeDisabled();
    const reason = screen.getByTestId("species-build-save-reason");
    expect(reason).toHaveTextContent(/hasn't earned any aptitude points yet/i);
  });

  it("budget refusal disables Confirm without clamping the input", () => {
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);
    const might = screen.getByTestId("species-build-input-Might");
    fireEvent.change(might, { target: { value: "1500" } });
    expect(screen.getByTestId("species-build-save")).toBeDisabled();
    expect((might as HTMLInputElement).value).toBe("1500");
  });

  it("a revert to baseline saves via Confirm with no ConfirmDialog", async () => {
    speciesData = freshState({ hasOverride: true });
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);
    for (const id of Object.keys(baseline)) {
      fireEvent.change(screen.getByTestId(`species-build-input-${id}`), { target: { value: "0" } });
    }
    fireEvent.click(screen.getByTestId("species-build-save"));

    expect(respecMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 1,
        speciesId: "fumeshroom",
        shares: expect.objectContaining({ Might: 0 })
      })
    );
    expect(screen.queryByTestId("species-build-respec-confirm")).not.toBeInTheDocument();
    await waitFor(() =>
      expect((screen.getByTestId("species-build-input-Might") as HTMLInputElement).value).toBe("0")
    );
  });

  it("a first override saves via Confirm with no ConfirmDialog", async () => {
    priceData!.everRespecced = false;
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);
    fireEvent.change(screen.getByTestId("species-build-input-Might"), { target: { value: "400" } });
    fireEvent.change(screen.getByTestId("species-build-input-Vigor"), { target: { value: "400" } });
    fireEvent.click(screen.getByTestId("species-build-save"));

    expect(respecMutateAsync).toHaveBeenCalled();
    expect(screen.queryByTestId("species-build-respec-confirm")).not.toBeInTheDocument();
    await waitFor(() =>
      expect((screen.getByTestId("species-build-input-Might") as HTMLInputElement).value).toBe("400")
    );
  });

  it("priced Confirm shows price on strip and spends without ConfirmDialog (S2)", () => {
    speciesData = freshState({ hasOverride: true });
    priceData = {
      speciesId: "fumeshroom",
      respecCount: 1,
      priceResource: "Soul",
      priceAmount: 75,
      everRespecced: true
    };
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);

    fireEvent.change(screen.getByTestId("species-build-input-Might"), { target: { value: "400" } });
    fireEvent.change(screen.getByTestId("species-build-input-Vigor"), { target: { value: "400" } });

    expect(screen.getByTestId("allocate-decision-price")).toHaveTextContent("75");
    expect(screen.queryByTestId("species-build-respec-confirm")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("species-build-save"));
    expect(respecMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playerId: 1, speciesId: "fumeshroom" })
    );
  });

  it("EP4.12: a free respec offers BOTH payments with no default, and nothing is sent until the player picks", async () => {
    speciesData = freshState({ hasOverride: true });
    priceData = {
      speciesId: "fumeshroom",
      respecCount: 1,
      priceResource: "Soul",
      priceAmount: 75,
      everRespecced: true,
      freeRespecStock: 2,
      freeAvailable: true
    };
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);

    fireEvent.change(screen.getByTestId("species-build-input-Might"), { target: { value: "400" } });

    // Both options are offered, NEITHER is chosen, and Confirm cannot proceed on an unmade choice - so no
    // request can carry a payWith the player did not choose (the acceptance's own words).
    expect(screen.getByTestId("species-build-pay-with")).toBeInTheDocument();
    expect((screen.getByTestId("pay-with-free") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId("pay-with-souls") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId("species-build-save")).toBeDisabled();
    fireEvent.click(screen.getByTestId("species-build-save"));
    expect(respecMutateAsync).not.toHaveBeenCalled();

    // Choosing the free respec sends exactly that spelling, and only then.
    fireEvent.click(screen.getByTestId("pay-with-free"));
    fireEvent.click(screen.getByTestId("species-build-save"));
    await waitFor(() => expect(respecMutateAsync).toHaveBeenCalledTimes(1));
    expect(respecMutateAsync.mock.calls[0][0]).toMatchObject({ payWith: "freeRespec" });
  });

  it("EP4.12: with no free respec available the request carries no payWith at all", () => {
    speciesData = freshState({ hasOverride: true });
    priceData = {
      speciesId: "fumeshroom",
      respecCount: 1,
      priceResource: "Soul",
      priceAmount: 75,
      everRespecced: true,
      freeRespecStock: 0,
      freeAvailable: false
    };
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);

    fireEvent.change(screen.getByTestId("species-build-input-Might"), { target: { value: "400" } });

    // Nothing to choose between, so no chooser is shown and the body is exactly today's - the server reads
    // the absent field as "no choice named".
    expect(screen.queryByTestId("species-build-pay-with")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("species-build-save"));
    expect(respecMutateAsync).toHaveBeenCalledTimes(1);
    expect(respecMutateAsync.mock.calls[0][0]).not.toHaveProperty("payWith");
  });

  it("Cancel on decision strip discards draft without spending", () => {    speciesData = freshState({ hasOverride: true });
    priceData = {
      speciesId: "fumeshroom",
      respecCount: 1,
      priceResource: "Soul",
      priceAmount: 75,
      everRespecced: true
    };
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);

    fireEvent.change(screen.getByTestId("species-build-input-Might"), { target: { value: "400" } });
    fireEvent.click(screen.getByTestId("allocate-decision-cancel"));

    expect(respecMutateAsync).not.toHaveBeenCalled();
    expect((screen.getByTestId("species-build-input-Might") as HTMLInputElement).value).toBe("500");
  });

  it("G7: a pending price never lets Confirm spend silently", () => {
    speciesData = freshState({ hasOverride: true });
    priceData = undefined;
    priceIsLoading = true;
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);

    fireEvent.change(screen.getByTestId("species-build-input-Might"), { target: { value: "400" } });
    fireEvent.change(screen.getByTestId("species-build-input-Vigor"), { target: { value: "400" } });

    expect(screen.getByTestId("species-build-save")).toBeDisabled();
    fireEvent.click(screen.getByTestId("species-build-save"));
    expect(respecMutateAsync).not.toHaveBeenCalled();
  });

  it("G7: an errored price also never lets Confirm spend silently", () => {
    speciesData = freshState({ hasOverride: true });
    priceData = undefined;
    priceIsError = true;
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);

    fireEvent.change(screen.getByTestId("species-build-input-Might"), { target: { value: "400" } });
    fireEvent.change(screen.getByTestId("species-build-input-Vigor"), { target: { value: "400" } });

    expect(screen.getByTestId("species-build-save")).toBeDisabled();
    fireEvent.click(screen.getByTestId("species-build-save"));
    expect(respecMutateAsync).not.toHaveBeenCalled();
  });

  it("no engine vocabulary appears in the rendered copy", () => {
    speciesData = freshState({ hasOverride: true });
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);
    const text = document.body.textContent ?? "";
    for (const forbidden of ["typeId", "scope_key", "AllocationScope", "CreatureType"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("ConfirmDialog is not in the Mode B tree (S2)", () => {
    speciesData = freshState({ hasOverride: true });
    priceData = {
      speciesId: "fumeshroom",
      respecCount: 1,
      priceResource: "Soul",
      priceAmount: 75,
      everRespecced: true
    };
    render(<SpeciesBuildPanel playerId={1} speciesId="fumeshroom" />);
    expect(screen.queryByTestId("species-build-respec-confirm")).not.toBeInTheDocument();
  });
});
