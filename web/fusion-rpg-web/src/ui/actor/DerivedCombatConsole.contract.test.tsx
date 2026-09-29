/**
 * DOM contract: Derived combat console must mount cook IA + HTML landmarks.
 * Fails if someone resurrects sheetGroup Offense/Pools as the primary rail
 * or Tailwind-cheaps away the SSOT structure.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { PLAYER_PENDING } from "@/contract/adapt";
import { known, pendingWithReason } from "@/contract/pending";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import type { ActorView } from "@/contract/types";
import {
  COOK_PRIMARY_TAB_IDS,
  FORBIDDEN_PRIMARY_TAB_IDS,
  DerivedTab
} from "./DerivedTab";

vi.mock("@/lib/bus/aura", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bus/aura")>("@/lib/bus/aura");
  return {
    ...actual,
    useActorSheet: () => sheetQuery,
    useActorDerived: () => derivedQuery
  };
});

vi.mock("@/lib/bus/actorSurface", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bus/actorSurface")>(
    "@/lib/bus/actorSurface"
  );
  return {
    ...actual,
    useDerivedSurface: () => ({
      data: actual.derivedSurfaceFromFixture(actual.actorSurfaceFixture()),
      isLoading: false,
      isError: false
    })
  };
});

let sheetQuery: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};
let derivedQuery: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function minimalActor(): ActorView {
  return {
    instanceId: "actor-1",
    playerId: 1,
    side: "plant",
    typeId: 1,
    displayName: known("Emberling"),
    phase: "ActiveBound",
    level: 24,
    xp: 0,
    xpToNext: pendingWithReason(PLAYER_PENDING.xpToNext),
    revision: 1,
    channelSummary: pendingWithReason(PLAYER_PENDING.channelSummary),
    elementTyping: pendingWithReason(PLAYER_PENDING.elementTyping),
    shieldStack: pendingWithReason(PLAYER_PENDING.shieldStack),
    equipSlots: pendingWithReason(PLAYER_PENDING.equipSlots)
  };
}

describe("DerivedCombatConsole DOM contract", () => {
  beforeEach(() => {
    sheetQuery = {
      isLoading: false,
      isError: false,
      refetch: async () => ({}),
      data: {
        instanceId: "actor-1",
        playerId: 1,
        side: "plant",
        typeId: 1,
        displayName: "Emberling",
        level: 24,
        derived: [
          {
            channelId: "combat.power.fire",
            displayName: "Power",
            reading: "Fire power",
            composeKind: "FlatSum",
            value: 2847,
            contributions: [
              {
                sourceId: "equip:muzzle:ember",
                label: "Equip · muzzle (ember)",
                op: "Flat",
                value: 980
              },
              {
                sourceId: "aptitude.Might",
                label: "Aptitude · Might",
                op: "Flat",
                value: 185
              }
            ]
          }
        ],
        primary: []
      }
    };
    derivedQuery = {
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: async () => ({})
    };
  });

  it("root landmark is derived-combat-console with HTML chrome classes", () => {
    wrap(<DerivedTab data={minimalActor()} surface={actorSurfaceFixture()} />);
    const root = screen.getByTestId("derived-combat-console");
    expect(root).toHaveClass("derived-combat-console", "console");
    expect(root.querySelector(".console-hd")).toBeNull();
    expect(root.querySelector(".cat-bar")).toBeTruthy();
    expect(root.querySelector(".hd-tools")).toBeTruthy();
    expect(root.querySelector(".inspect-split")).toBeTruthy();
    expect(root.querySelector(".inspect")).toBeTruthy();
    expect(root.querySelector(".foot")).toBeTruthy();
  });

  it("inspect-split is a direct child of .console (CSS > contract)", () => {
    wrap(<DerivedTab data={minimalActor()} surface={actorSurfaceFixture()} />);
    const root = screen.getByTestId("derived-combat-console");
    expect(root.querySelector(":scope > .inspect-split")).toBeTruthy();
    expect(root.querySelector(":scope > .inspect-split > .dock")).toBeTruthy();
    expect(root.querySelector(":scope > .inspect-split > .inspect")).toBeTruthy();
    // No intervening wrapper between .console and .inspect-split
    expect(root.querySelector(":scope > .contents")).toBeNull();
  });

  it("primary tablist is exactly cook ids — never sheetGroups", () => {
    wrap(<DerivedTab data={minimalActor()} surface={actorSurfaceFixture()} />);
    const tablist = screen.getByTestId("derived-tab");
    const tabs = within(tablist).getAllByRole("tab");
    const ids = tabs.map((t) => t.getAttribute("data-tab") ?? t.getAttribute("data-testid"));
    expect(ids).toEqual([...COOK_PRIMARY_TAB_IDS].map((id) => id));

    for (const forbidden of FORBIDDEN_PRIMARY_TAB_IDS) {
      expect(screen.queryByTestId(`derived-tab-${forbidden}`)).not.toBeInTheDocument();
      expect(
        within(tablist).queryByRole("tab", { name: new RegExp(`^${forbidden}$`, "i") })
      ).not.toBeInTheDocument();
    }

    // Labels must not be Offense / Pools as primary chips
    const labels = tabs.map((t) => (t.textContent ?? "").toLowerCase());
    expect(labels.some((l) => l.startsWith("offense"))).toBe(false);
    expect(labels.some((l) => l.startsWith("pools"))).toBe(false);
  });

  it("Elements shows variant rail with fire (and other elements)", () => {
    wrap(<DerivedTab data={minimalActor()} surface={actorSurfaceFixture()} />);
    const rail = screen.getByTestId("derived-variant-rail");
    expect(rail).toHaveClass("variant-bar");
    expect(screen.getByTestId("derived-variant-fire")).toBeInTheDocument();
    expect(screen.getByTestId("derived-variant-fire")).toHaveAttribute("data-el", "fire");
  });

  it("inspect exposes share-donut, stack, and sources landmarks matching HTML", () => {
    wrap(<DerivedTab data={minimalActor()} surface={actorSurfaceFixture()} />);
    expect(screen.getByTestId("derived-inspector")).toBeInTheDocument();
    expect(screen.getByTestId("derived-share-donut")).toBeInTheDocument();
    expect(screen.getByTestId("derived-stack")).toBeInTheDocument();
    expect(screen.getByTestId("derived-sources")).toBeInTheDocument();
    expect(screen.getByTestId("derived-contribution-chart").querySelector(".share-donut")).toBeTruthy();
    expect(screen.getByTestId("derived-contribution-chart").querySelector(".stack")).toBeTruthy();
    expect(screen.getByTestId("derived-stack").querySelector(".stack-row")).toBeTruthy();
    // DC-8: player band — no GG-49 / Join channelId
    expect(screen.getByTestId("derived-sources").textContent ?? "").not.toMatch(/GG-49/);
    expect(screen.getByTestId("derived-inspector").textContent ?? "").not.toMatch(/Join:\s*combat\.power/);
  });
});
