/**
 * spec-auto-assign-control.md (EP1.20) — the producer half of W2. `auto-assign-rule-strip` is bound
 * into the existing `aptitudes-console` recipe's hero slot and emits `aptitude.autoAssign` (C2);
 * the ids it renders are the server's answer for the scope (`GET /api/aptitude-presets/rules`, C1),
 * never an FE list, and its labels come from `aptitude-auto-assign-catalog.v1.json`.
 *
 * Mounted through the real recipe (`RecipeMount`), so a piece that is not registered, or not bound
 * into the hero slot, fails here rather than passing a factory call directly.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import { asSurfaceBusLike } from "@/features/gui-lego/createSurfaceBus";
import { createAptitudesSurfaceBus } from "@/features/gui-lego/aptitudesSurfaceBus";
import { foldAptitudesSurfaceVm } from "@/features/gui-lego/foldAptitudesSurfaceVm";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import { RecipeMount } from "@/ui/gui-lego/RecipeMount";
import { ensureAptitudesGuiLegoRegistered } from "@/ui/gui-lego/registerAptitudes";
import aptitudesRecipe from "@/ui/gui-lego/recipes/aptitudes-console.json";
import type { RecipeDocument } from "@/features/gui-lego/types";
import autoAssignCatalogJson from "../../../../../../data/tuning/aptitude-auto-assign-catalog.v1.json";

/** What the server answers for a unique/species scope: the whole closed six. */
const SERVER_UNIQUE_RULES = [
  "active-preset",
  "species-favour",
  "posture-force",
  "posture-finesse",
  "posture-bastion",
  "even"
];
/** Mode C — the server omits `species-favour`, so the FE never decides that hiding rule itself (C5). */
const SERVER_COMMANDER_RULES = SERVER_UNIQUE_RULES.filter((id) => id !== "species-favour");

function mountStrip(mode: "unique" | "commander", rules: string[], saving = false) {
  ensureAptitudesGuiLegoRegistered();
  const surface = actorSurfaceFixture();
  const draft: Record<string, number> = {};
  for (const row of surface.aptitudes) draft[row.id] = 0;
  const vm = foldAptitudesSurfaceVm({
    mode,
    surface,
    draftShares: draft,
    budget: 100,
    spent: 0,
    leftover: 100,
    dirty: false,
    withinBudget: true,
    saving,
    selectedAptitudeId: null,
    theta: 10,
    availability: "ready",
    revision: 1,
    autoAssignRules: rules
  });
  const plan = bindSurface(aptitudesRecipe as RecipeDocument, vm, { preferOverlay: false });
  const typedBus = createAptitudesSurfaceBus();
  const emitted: { rule?: string }[] = [];
  typedBus.onAny((event, payload) => {
    if (event === "aptitude.autoAssign") emitted.push((payload ?? {}) as { rule?: string });
  });
  render(<RecipeMount plan={plan} bus={asSurfaceBusLike(typedBus)} />);
  return { emitted };
}

function renderedRuleIds(): (string | null)[] {
  return Array.from(screen.getByTestId("auto-assign-rule-strip").querySelectorAll("button")).map((b) =>
    (b.getAttribute("data-testid") ?? "").replace("auto-assign-rule-", "")
  );
}

describe("auto-assign-rule-strip (EP1.20)", () => {
  it("renders exactly the server's rule ids, in the server's order", () => {
    mountStrip("unique", SERVER_UNIQUE_RULES);
    expect(renderedRuleIds()).toEqual(SERVER_UNIQUE_RULES);
  });

  it("choosing each server-listed rule emits exactly one aptitude.autoAssign with that rule", async () => {
    const user = userEvent.setup();
    const { emitted } = mountStrip("unique", SERVER_UNIQUE_RULES);
    for (const rule of SERVER_UNIQUE_RULES) {
      await user.click(screen.getByTestId(`auto-assign-rule-${rule}`));
    }
    // Exactly one event per choose, in click order, and nothing else on the bus payload.
    expect(emitted).toEqual(SERVER_UNIQUE_RULES.map((rule) => ({ rule })));
  });

  it("labels come from the catalog, never a string baked into the piece", () => {
    mountStrip("unique", SERVER_UNIQUE_RULES);
    for (const rule of SERVER_UNIQUE_RULES) {
      const row = autoAssignCatalogJson.entries.find((e) => e.id === rule);
      expect(row, `catalog has a row for ${rule}`).toBeTruthy();
      expect(screen.getByTestId(`auto-assign-rule-${rule}`)).toHaveTextContent(row!.displayName);
    }
  });

  it("Mode C shows what the server listed: no species-favour, and even stays available (C4/C5)", () => {
    mountStrip("commander", SERVER_COMMANDER_RULES);
    expect(renderedRuleIds()).toEqual(SERVER_COMMANDER_RULES);
    expect(screen.queryByTestId("auto-assign-rule-species-favour")).toBeNull();
    expect(screen.getByTestId("auto-assign-rule-even")).toBeInTheDocument();
  });

  it("an unanswered rule list renders no strip at all — never an FE fallback list", () => {
    mountStrip("unique", []);
    expect(screen.queryByTestId("auto-assign-rule-strip")).toBeNull();
  });

  it("while the draft is saving, every rule is disabled and says why", () => {
    mountStrip("unique", SERVER_UNIQUE_RULES, true);
    for (const rule of SERVER_UNIQUE_RULES) {
      expect(screen.getByTestId(`auto-assign-rule-${rule}`)).toBeDisabled();
    }
    expect(screen.getByTestId("auto-assign-rule-even")).toHaveAttribute("title", "Saving…");
  });

  it("choosing a rule is a draft action only: no allocate/respec mutation is called", async () => {
    const user = userEvent.setup();
    const { emitted } = mountStrip("unique", SERVER_UNIQUE_RULES);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await user.click(screen.getByTestId("auto-assign-rule-even"));
    expect(emitted).toEqual([{ rule: "even" }]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
