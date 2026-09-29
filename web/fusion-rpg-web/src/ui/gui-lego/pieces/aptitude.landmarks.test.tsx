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

describe("aptitude pieces landmarks", () => {
  it("mounts leftover-gauge, Cancel fiction, catalog icon tile, posture theme", async () => {
    ensureAptitudesGuiLegoRegistered();
    const surface = actorSurfaceFixture();
    const draft: Record<string, number> = {};
    for (const row of surface.aptitudes) draft[row.id] = row.id === "Might" ? 5 : 0;
    const vm = foldAptitudesSurfaceVm({
      mode: "unique",
      surface,
      draftShares: draft,
      budget: 100,
      spent: 5,
      leftover: 95,
      dirty: true,
      withinBudget: true,
      saving: false,
      selectedAptitudeId: "Might",
      theta: 10,
      availability: "ready",
      revision: 1
    });
    const plan = bindSurface(aptitudesRecipe as RecipeDocument, vm, { preferOverlay: false });
    const typedBus = createAptitudesSurfaceBus();
    const step = vi.fn();
    typedBus.on("aptitude.step", step);
    render(<RecipeMount plan={plan} bus={asSurfaceBusLike(typedBus)} />);

    expect(screen.getByTestId("leftover-gauge")).toBeInTheDocument();
    expect(screen.getByTestId("allocate-decision-cancel")).toHaveTextContent("Cancel");
    expect(screen.getByTestId("aptitude-icon-Might")).toBeInTheDocument();
    expect(screen.getByTestId("aptitude-posture-force")).toHaveTextContent("Force");
    expect(screen.getByTestId("aptitudes-scope-chip")).toHaveTextContent("Unique specimen");

    const user = userEvent.setup();
    await user.click(screen.getByTestId("aptitude-inc-Might"));
    expect(step).toHaveBeenCalled();
  });
});
