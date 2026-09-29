import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { absent, pendingWithReason } from "@/contract/pending";
import type { EventView } from "@/contract/types";
import { EventPanel } from "./EventPanel";

function eventView(overrides: Partial<EventView> = {}): EventView {
  return {
    eventId: absent(),
    kind: absent(),
    choices: absent(),
    banner: absent(),
    warnings: absent(),
    ...overrides
  };
}

describe("EventPanel (D5.7, spec-delve-stage.md §7 — choices, warnings, the banner)", () => {
  it("a room with no real event renders its own honest absent copy, not a Pending 'coming soon' tone", () => {
    render(<EventPanel event={eventView()} />);
    expect(screen.getByTestId("delve-event-kind")).toHaveTextContent("There's nothing happening here.");
    expect(screen.getByTestId("delve-event-choices")).toHaveTextContent("There's nothing happening here.");
  });

  it("a room with a real event renders each field's own real pending reason", () => {
    render(
      <EventPanel
        event={eventView({
          kind: pendingWithReason("What's happening in this room isn't shown yet"),
          choices: pendingWithReason("What's happening in this room isn't shown yet"),
          warnings: pendingWithReason("What's happening in this room isn't shown yet")
        })}
      />
    );
    expect(screen.getByTestId("delve-event-kind")).toHaveTextContent(
      "What's happening in this room isn't shown yet"
    );
    expect(screen.getByTestId("delve-event-warnings")).toHaveTextContent(
      "What's happening in this room isn't shown yet"
    );
  });

  it("never renders the banner field's own content — that arrives through the ui.present sink, not this panel", () => {
    render(
      <EventPanel
        event={eventView({ banner: pendingWithReason("should never appear in this panel's own body") })}
      />
    );
    const root = screen.getByTestId("delve-panel-event");
    expect(root.textContent ?? "").not.toMatch(/should never appear/);
  });
});
