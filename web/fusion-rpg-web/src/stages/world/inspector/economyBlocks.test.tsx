import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SectorLoamBlock } from "./SectorLoamBlock";
import { ComponentBlock } from "./ComponentBlock";
import { maximalSector } from "./fixtures/maximalSector";

describe("SectorLoamBlock — this sector's own loam (world-stage W61)", () => {
  it("renders all four readings through world-numbers, and the upkeep figure opens the ledger", async () => {
    const user = userEvent.setup();
    render(<SectorLoamBlock sector={maximalSector} />);

    const block = screen.getByTestId("sector-loam-block");
    expect(block).toHaveTextContent("140"); // production
    expect(block).toHaveTextContent("2,400"); // stock

    const upkeepTrigger = screen.getByTestId("modifier-ledger-trigger");
    await user.click(upkeepTrigger);
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("modifier-ledger-popup")).toBeInTheDocument();
  });

  it("the ledger's rows sum back to the same upkeep total shown beside them", async () => {
    const user = userEvent.setup();
    render(<SectorLoamBlock sector={maximalSector} />);
    await user.click(screen.getByTestId("modifier-ledger-trigger"));
    await user.keyboard("{Enter}");

    const b = maximalSector.loam.upkeepBreakdown;
    const expectedTotal = b.base.value + b.garrison.value + b.development.value + Math.trunc((b.danger.value * b.intensityMilli.value) / 1000);
    expect(screen.getByTestId("modifier-ledger-computed-total")).toHaveTextContent(String(expectedTotal));
  });

});

describe("ComponentBlock — the detail half of summary-up/detail-down (world-stage W61)", () => {
  it("renders the pooled component reading when part of a connected territory", () => {
    render(<ComponentBlock sector={maximalSector} />);
    const block = screen.getByTestId("component-block");
    expect(block).toHaveTextContent("410");
    expect(block).toHaveTextContent("6,200");
  });

  it("states plainly when not part of a connected territory", () => {
    render(
      <ComponentBlock
        sector={{
          ...maximalSector,
          component: { componentId: null, production: maximalSector.loam.production, upkeep: maximalSector.loam.upkeep, net: maximalSector.loam.net, stock: maximalSector.loam.stock }
        }}
      />
    );
    expect(screen.getByTestId("component-block")).toHaveTextContent("Not part of a connected territory");
    expect(screen.queryByTestId("component-block-starving")).not.toBeInTheDocument();
  });

  it("§4.3's first-class case: a starving reach renders even though this sector's own loam is fine", () => {
    render(
      <ComponentBlock
        sector={{
          ...maximalSector,
          // This sector's own numbers (loam.*) stay healthy — component.net is what's negative.
          component: { componentId: "c-starving", production: maximalSector.loam.production, upkeep: maximalSector.loam.upkeep, net: { unit: "loamUnits", value: -40 }, stock: maximalSector.loam.stock }
        }}
      />
    );
    expect(screen.getByTestId("component-block-starving")).toHaveTextContent("can't cover its own keep");
  });

  it("the starving alarm carries a non-colour glyph and doubled border, not colour alone", () => {
    render(
      <ComponentBlock
        sector={{ ...maximalSector, component: { ...maximalSector.component, net: { unit: "loamUnits", value: -1 } } }}
      />
    );
    const alarm = screen.getByTestId("component-block-starving");
    expect(alarm.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(alarm.className).toMatch(/border-2/);
  });
});
