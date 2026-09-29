import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { known } from "@/contract/pending";
import type { ExtractionView } from "@/contract/types";
import { adaptExtraction } from "@/contract/adapt";
import { useLayerStack } from "@/shell/layerStack";
import { useToastStack } from "@/shell/toastStack";
import { Toasts } from "@/shell/Toasts";
import { useDelveReportQueue } from "./reportQueue";
import { ExtractionSummary } from "./ExtractionSummary";
import { DEMO_EXTRACTION } from "./extractionFixture";

function resetStores() {
  useLayerStack.getState().popAll();
  useToastStack.getState().clear();
  useDelveReportQueue.setState({ held: false, pending: [] });
}

afterEach(resetStores);

describe("ExtractionSummary (D5.9, spec-delve-stage.md §7 band-3 row)", () => {
  it("renders souls from kills and victory as two separate figures, never pre-summed", () => {
    render(<ExtractionSummary open extraction={DEMO_EXTRACTION} onOpenChange={() => {}} />);
    expect(screen.getByTestId("delve-summary-souls-kills")).toHaveTextContent("340");
    expect(screen.getByTestId("delve-summary-souls-victory")).toHaveTextContent("1,200");
    // No composed total figure anywhere — §16's own "never do arithmetic on a figure in the client".
    expect(screen.queryByText("1,540")).not.toBeInTheDocument();
  });

  it("renders every real SettlementOutcome through extractionOutcomeLabel, never the raw wire word", () => {
    render(<ExtractionSummary open extraction={DEMO_EXTRACTION} onOpenChange={() => {}} />);
    expect(screen.getByTestId("delve-summary-outcome-demo-1")).toHaveTextContent("Unharmed");
    expect(screen.getByTestId("delve-summary-outcome-demo-3")).toHaveTextContent("Recovering");
    expect(screen.getByTestId("delve-summary-outcome-demo-4")).toHaveTextContent("Fallen");
    expect(screen.getByTestId("delve-summary-outcome-demo-5")).toHaveTextContent("Fallen");
    // Never the raw enum members, and never the banned word "Retired" (D5.10's own BANNED_WORDS entry).
    expect(screen.getByTestId("delve-summary-member-demo-4")).not.toHaveTextContent(/\bRetire\b/);
    expect(screen.getByTestId("delve-summary-member-demo-4")).not.toHaveTextContent(/retired/i);
  });

  it("shows the recovery count only for the Recover outcome, pluralised correctly", () => {
    render(<ExtractionSummary open extraction={DEMO_EXTRACTION} onOpenChange={() => {}} />);
    expect(screen.getByTestId("delve-summary-recover-demo-3")).toHaveTextContent("2 more descents");
    expect(screen.queryByTestId("delve-summary-recover-demo-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delve-summary-recover-demo-4")).not.toBeInTheDocument();
  });

  it("singularises the recovery count at exactly one", () => {
    const view: ExtractionView = adaptExtraction(
      [{ instanceId: "m-1", settlement: { outcome: "Recover", recoverDelves: 1, won: false } }],
      { kills: 0, victory: 0 }
    );
    render(<ExtractionSummary open extraction={view} onOpenChange={() => {}} />);
    expect(screen.getByTestId("delve-summary-recover-m-1")).toHaveTextContent("1 more descent");
    expect(screen.getByTestId("delve-summary-recover-m-1")).not.toHaveTextContent("descents");
  });

  it("tags a won member as Cleared, and does not tag one that did not clear", () => {
    render(<ExtractionSummary open extraction={DEMO_EXTRACTION} onOpenChange={() => {}} />);
    expect(screen.getByTestId("delve-summary-cleared-demo-1")).toHaveTextContent("Cleared");
    expect(screen.queryByTestId("delve-summary-cleared-demo-3")).not.toBeInTheDocument();
  });

  it("folds the permanent-loss notice into the summary body, counting the real Retire outcomes, pluralised", () => {
    render(<ExtractionSummary open extraction={DEMO_EXTRACTION} onOpenChange={() => {}} />);
    expect(screen.getByTestId("delve-summary-fallen-notice")).toHaveTextContent("2 members fell for good this run.");
  });

  it("renders no permanent-loss notice at all when nobody fell", () => {
    const view: ExtractionView = adaptExtraction(
      [{ instanceId: "m-1", settlement: { outcome: "Roster", recoverDelves: 0, won: true } }],
      { kills: 10, victory: 10 }
    );
    render(<ExtractionSummary open extraction={view} onOpenChange={() => {}} />);
    expect(screen.queryByTestId("delve-summary-fallen-notice")).not.toBeInTheDocument();
  });

  it("singularises the permanent-loss notice at exactly one", () => {
    const view: ExtractionView = adaptExtraction(
      [{ instanceId: "m-1", settlement: { outcome: "Retire", recoverDelves: 0, won: false } }],
      { kills: 0, victory: 0 }
    );
    render(<ExtractionSummary open extraction={view} onOpenChange={() => {}} />);
    expect(screen.getByTestId("delve-summary-fallen-notice")).toHaveTextContent("1 member fell for good this run.");
  });

  it("renders wiped/firstClearGrant/levelUps/joins honestly through the real Pending reasons adaptExtraction produces today", () => {
    render(<ExtractionSummary open extraction={DEMO_EXTRACTION} onOpenChange={() => {}} />);
    expect(screen.getByTestId("delve-summary-wiped")).toHaveTextContent("Whether the raid wiped isn't shown yet");
    expect(screen.getByTestId("delve-summary-first-clear")).toHaveTextContent("A first-clear reward isn't shown yet");
    expect(screen.getByTestId("delve-summary-level-ups")).toHaveTextContent("Level-ups aren't shown yet");
    expect(screen.getByTestId("delve-summary-joins")).toHaveTextContent("New arrivals aren't shown yet");
  });

  it("renders the known branches too, even though no real producer emits them yet (FightInPlace/QuestTracker's own precedent for full-state coverage)", () => {
    const view: ExtractionView = {
      ...DEMO_EXTRACTION,
      wiped: known(true),
      firstClearGrant: known({ some: "grant" }),
      levelUps: known([{}, {}, {}]),
      joins: known([{}])
    };
    render(<ExtractionSummary open extraction={view} onOpenChange={() => {}} />);
    expect(screen.getByTestId("delve-summary-wiped")).toHaveTextContent("The raid wiped.");
    expect(screen.getByTestId("delve-summary-first-clear")).toHaveTextContent("A first-clear reward was granted.");
    expect(screen.getByTestId("delve-summary-level-ups")).toHaveTextContent("3 level-ups");
    expect(screen.getByTestId("delve-summary-joins")).toHaveTextContent("1 new arrival");
  });

  it("never renders a raw instanceId as visible copy — it appears only inside data-testid attributes", () => {
    render(<ExtractionSummary open extraction={DEMO_EXTRACTION} onOpenChange={() => {}} />);
    const body = screen.getByTestId("extraction-summary-body");
    expect(body.textContent).not.toMatch(/demo-\d/);
  });

  it("the Close button calls onOpenChange(false)", async () => {
    const user = userEvent.setup();
    let open = true;
    const onOpenChange = (next: boolean) => {
      open = next;
    };
    render(<ExtractionSummary open={open} extraction={DEMO_EXTRACTION} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId("delve-summary-close"));
    expect(open).toBe(false);
  });

  it("rendered with open=false leaves the layer stack empty (the world-confirms W105 precedent, applied here)", () => {
    render(<ExtractionSummary open={false} extraction={DEMO_EXTRACTION} onOpenChange={() => {}} />);
    expect(useLayerStack.getState().layers).toEqual([]);
  });

  it("Reports_land_at_band_4_and_wait_behind_the_summary — a report pushed while the summary is open does not reach the toast stack until it closes", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <ExtractionSummary open={open} onOpenChange={setOpen} extraction={DEMO_EXTRACTION} />
          <Toasts />
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId("extraction-summary")).toBeInTheDocument();

    useDelveReportQueue.getState().push({ kind: "drop", title: "Found a relic" });

    // Still behind the summary — band 4 shows nothing yet.
    expect(useToastStack.getState().toasts).toEqual([]);
    expect(screen.queryByTestId("toast-stack")?.textContent ?? "").not.toContain("Found a relic");

    // Close via the summary's OWN real close affordance — Radix's modal Dialog sets
    // `pointer-events: none` on everything outside its own portal while open (by design: you cannot
    // click "through" a modal), so a harness-external trigger is unclickable here and would not be
    // a realistic path anyway. `delve-summary-close` is the actual, only way this dialog closes.
    // Wrapped explicitly: the flush this click triggers reaches `Toasts` through `useToastStack`'s
    // own external-store subscription from inside a `useEffect` cleanup (`ExtractionSummary`'s own
    // hold/release effect), one hop removed from the click handler itself — `userEvent`'s own
    // internal `act()` wrapping does not reach that hop, so React logs a benign "not wrapped in
    // act" warning without this outer wrap even though the assertion below already passes correctly.
    await act(async () => {
      await user.click(screen.getByTestId("delve-summary-close"));
    });

    await waitFor(() => expect(useToastStack.getState().toasts).toHaveLength(1));
    expect(screen.getByText("Found a relic")).toBeInTheDocument();
  });

  it("a report pushed before the summary ever opens is unaffected — only reports queued during an OPEN summary wait", () => {
    useDelveReportQueue.getState().push({ kind: "join", title: "Arrived early" });
    expect(useToastStack.getState().toasts).toHaveLength(1);

    render(<ExtractionSummary open extraction={DEMO_EXTRACTION} onOpenChange={() => {}} />);
    // The already-delivered toast is untouched by the summary opening afterward.
    expect(useToastStack.getState().toasts).toHaveLength(1);
  });
});
