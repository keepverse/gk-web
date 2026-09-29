import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PLAYER_PENDING } from "@/contract/adapt";
import { known, pendingWithReason } from "@/contract/pending";
import type { ActorView } from "@/contract/types";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import { AptitudesTab } from "./AptitudesTab";
import { resetAptitudeObsForTests } from "./aptitudeObs";

const mutateCommander = vi.fn();
const mutateUnique = vi.fn();
const mutateRespecQuote = vi.fn(async () => ({ isRespec: false, soulPrice: 0, respecCount: 0 }));
const rulesMock = vi.fn();
const commanderData = {
  theta: 100,
  budget: 300,
  shares: { Might: 12, Fortitude: 8, Agility: 5 }
};
const uniqueData = {
  instanceId: "a1",
  playerId: 1,
  specimenLevel: 14,
  budget: 200,
  spent: 20,
  leftover: 180,
  withinBudget: true,
  shares: { Might: 10, Fortitude: 5, Agility: 5 },
  theta: 80,
  isDefault: false,
  defaultRuleId: null as string | null
};

vi.mock("@/lib/bus", () => ({
  usePlayers: () => ({ data: { currentPlayerId: 1 } }),
  useAptitudes: (playerId: number | null | undefined) =>
    playerId
      ? { data: commanderData, isLoading: false }
      : { data: undefined, isLoading: false },
  useUniqueAptitudes: (instanceId: string | null | undefined) =>
    instanceId
      ? { data: uniqueData, isLoading: false }
      : { data: undefined, isLoading: false },
  useSaveAptitudes: () => ({ mutateAsync: mutateCommander, isPending: false }),
  useSaveUniqueAptitudes: () => ({ mutateAsync: mutateUnique, isPending: false }),
  useAptitudeRespecQuote: () => ({ mutateAsync: mutateRespecQuote, isPending: false }),
  newCorrelationId: () => "test-correlation-id"
}));

vi.mock("@/lib/bus/aptitudePresets", () => ({
  probeAptitudePresetsApi: vi.fn(async () => true),
  useAptitudePresetActive: () => ({ data: { presetId: null }, isLoading: false }),
  useAutoAssignRules: (scope: string | null | undefined) => rulesMock(scope)
}));

// spec-auto-assign-control.md (EP1.20, C1) — the server's own answer for each scope. The unique
// answer is the whole closed six; the commander answer omits `species-favour` server-side (C5), so
// the FE is never the thing deciding that hiding rule.
const UNIQUE_RULES = [
  "active-preset",
  "species-favour",
  "posture-force",
  "posture-finesse",
  "posture-bastion",
  "even"
];
const COMMANDER_RULES = UNIQUE_RULES.filter((id) => id !== "species-favour");

function actor(): ActorView {
  return {
    instanceId: "a1",
    playerId: 1,
    side: "plant",
    typeId: 3,
    displayName: known("Emberling"),
    phase: "ActiveBound",
    level: 14,
    xp: 2140,
    xpToNext: pendingWithReason(PLAYER_PENDING.xpToNext),
    revision: 1,
    channelSummary: pendingWithReason(PLAYER_PENDING.channelSummary),
    elementTyping: pendingWithReason(PLAYER_PENDING.elementTyping),
    shieldStack: pendingWithReason(PLAYER_PENDING.shieldStack),
    equipSlots: pendingWithReason(PLAYER_PENDING.equipSlots)
  };
}

describe("AptitudesTab", () => {
  beforeEach(() => {
    mutateCommander.mockReset();
    mutateUnique.mockReset();
    mutateRespecQuote.mockReset();
    mutateRespecQuote.mockResolvedValue({ isRespec: false, soulPrice: 0, respecCount: 0 });
    resetAptitudeObsForTests();
    // spec-default-build.md EP1.17: reset to "not a default" so tests that don't care about the
    // label never see it, and the two label tests below control it explicitly.
    uniqueData.isDefault = false;
    uniqueData.defaultRuleId = null;
    // EP1.20: the scope's own server answer by default (a test that cares overrides it).
    rulesMock.mockReset();
    rulesMock.mockImplementation(() => ({ data: UNIQUE_RULES, isLoading: false }));
  });

  it("Mode A creature uses UniqueCreature scope and catalog icons", () => {
    const surface = actorSurfaceFixture();
    render(<AptitudesTab data={actor()} surface={surface} role="creature" />);
    expect(screen.getByTestId("aptitudes-tab")).toHaveAttribute("data-mode", "unique");
    expect(screen.getByTestId("aptitudes-scope-chip")).toHaveTextContent("Unique specimen");
    expect(screen.getByTestId("aptitude-tile-Might")).toHaveTextContent("Might");
    expect(screen.getByTestId("aptitude-icon-Might")).toBeInTheDocument();
  });

  it("Mode C commander chip fiction differs from UniqueCreature", () => {
    const surface = actorSurfaceFixture();
    render(<AptitudesTab data={actor()} surface={surface} role="commander" />);
    expect(screen.getByTestId("aptitudes-tab")).toHaveAttribute("data-mode", "commander");
    expect(screen.getByTestId("aptitudes-scope-chip")).toHaveTextContent("Commander");
  });

  it("reports draft leftover upward when a tile increments", async () => {
    const user = userEvent.setup();
    const onDraftState = vi.fn();
    const surface = actorSurfaceFixture();
    render(
      <AptitudesTab data={actor()} surface={surface} role="creature" onDraftState={onDraftState} />
    );
    await user.click(screen.getByTestId("aptitude-inc-Might"));
    const last = onDraftState.mock.calls.at(-1)?.[0];
    expect(last?.dirty).toBe(true);
    expect(last?.mode).toBe("unique");
    expect(last?.spent).toBeGreaterThan(20);
  });

  it("Confirm save posts UniqueCreature allocate for Mode A", async () => {
    mutateUnique.mockResolvedValue(uniqueData);
    const onDraftState = vi.fn();
    const user = userEvent.setup();
    const surface = actorSurfaceFixture();
    render(
      <AptitudesTab data={actor()} surface={surface} role="creature" onDraftState={onDraftState} />
    );
    await user.click(screen.getByTestId("aptitude-inc-Might"));
    const draft = onDraftState.mock.calls.at(-1)?.[0];
    await draft.save();
    expect(mutateUnique).toHaveBeenCalled();
    expect(mutateCommander).not.toHaveBeenCalled();
  });

  // ---- EP1.17: the sheet labels a default as a default -----------------------------------------

  it("shows the RULE_LABELS catalog copy when the server reports a default", () => {
    uniqueData.isDefault = true;
    uniqueData.defaultRuleId = "even";
    const surface = actorSurfaceFixture();
    render(<AptitudesTab data={actor()} surface={surface} role="creature" />);
    expect(screen.getByTestId("aptitude-default-label")).toHaveTextContent("Suggested build (Even split)");
  });

  it("shows no default label once an explicit allocation exists", () => {
    uniqueData.isDefault = false;
    uniqueData.defaultRuleId = null;
    const surface = actorSurfaceFixture();
    render(<AptitudesTab data={actor()} surface={surface} role="creature" />);
    expect(screen.queryByTestId("aptitude-default-label")).not.toBeInTheDocument();
  });

  it("never shows a default label for the commander scope (map D1 -- out of scope)", () => {
    const surface = actorSurfaceFixture();
    render(<AptitudesTab data={actor()} surface={surface} role="commander" />);
    expect(screen.queryByTestId("aptitude-default-label")).not.toBeInTheDocument();
  });

  // ---- EP1.20: the host hands the SERVER's rule list to the strip (C1/C5) ----------------------

  it("renders the rule strip from the server's answer for the scope, never an FE list", () => {
    const surface = actorSurfaceFixture();
    render(<AptitudesTab data={actor()} surface={surface} role="creature" />);
    expect(rulesMock).toHaveBeenCalledWith("unique");
    const strip = screen.getByTestId("auto-assign-rule-strip");
    expect(Array.from(strip.querySelectorAll("button")).map((b) => b.getAttribute("data-testid"))).toEqual(
      UNIQUE_RULES.map((rule) => `auto-assign-rule-${rule}`)
    );
  });

  it("Mode C asks the server for the commander scope, and shows no species-favour", () => {
    rulesMock.mockImplementation(() => ({ data: COMMANDER_RULES, isLoading: false }));
    const surface = actorSurfaceFixture();
    render(<AptitudesTab data={actor()} surface={surface} role="commander" />);
    expect(rulesMock).toHaveBeenCalledWith("commander");
    expect(screen.queryByTestId("auto-assign-rule-species-favour")).toBeNull();
    expect(screen.getByTestId("auto-assign-rule-even")).toBeInTheDocument();
  });
});
