import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActorCollection, type ActorCollectionItem } from "./ActorCollection";
import {
  ACTOR_COLLECTION_RENDER_ALL_MAX,
  ACTOR_COLLECTION_SEARCH_FIRST_ABOVE
} from "@/ui/lawn/lawnPresentationTokens";
import { clearLawnInteractiveLog, peekLawnInteractiveLog } from "@/ui/lawn/lawnInteractiveObserve";

function many(n: number): ActorCollectionItem[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `k${i}`,
    label: `Actor ${i}`,
    sideLabel: i % 2 === 0 ? "plant" : "zombie",
    chip: i === 0 ? "Fielded" : "Wave"
  }));
}

describe("ActorCollection", () => {
  it("renders all when ≤24", () => {
    render(<ActorCollection items={many(ACTOR_COLLECTION_RENDER_ALL_MAX)} />);
    expect(screen.getByTestId("actor-collection")).toHaveAttribute("data-volume", "all");
    expect(screen.getByTestId("actor-collection-list")).toHaveAttribute("data-virtualized", "false");
  });

  it("windows when 25–240", () => {
    render(<ActorCollection items={many(ACTOR_COLLECTION_RENDER_ALL_MAX + 1)} />);
    expect(screen.getByTestId("actor-collection")).toHaveAttribute("data-volume", "windowed");
    expect(screen.getByTestId("actor-collection-list")).toHaveAttribute("data-virtualized", "true");
  });

  it("search-first above 240 until query narrows", async () => {
    const user = userEvent.setup();
    render(<ActorCollection items={many(ACTOR_COLLECTION_SEARCH_FIRST_ABOVE + 1)} />);
    expect(screen.getByTestId("actor-collection")).toHaveAttribute("data-volume", "search-first");
    expect(screen.getByTestId("actor-collection-search-first")).toBeInTheDocument();
    await user.type(screen.getByTestId("actor-collection-search"), "Actor 0");
    expect(screen.queryByTestId("actor-collection-search-first")).not.toBeInTheDocument();
  });

  it("logs select observability", async () => {
    clearLawnInteractiveLog();
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ActorCollection items={many(2)} onSelect={onSelect} />);
    await user.click(screen.getByTestId("actor-collection-item-k0"));
    expect(onSelect).toHaveBeenCalledWith("k0");
    expect(peekLawnInteractiveLog().some((e) => e.event === "collection.select")).toBe(true);
  });
});
