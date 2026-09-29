import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { absent, known, pendingWithReason } from "@/contract/pending";
import type { ObjectPromptView } from "@/contract/types";
import { ObjectPromptPanel } from "./ObjectPromptPanel";

function promptView(overrides: Partial<ObjectPromptView> = {}): ObjectPromptView {
  return {
    sectorId: "s-5",
    kind: "Curio",
    verbs: ["open", "loot"],
    oneShot: false,
    ...overrides
  };
}

describe("ObjectPromptPanel (D5.7, spec-delve-stage.md §7 — one panel per RoomObject)", () => {
  it("renders the real kind and every offered verb through labels.ts, never a raw id", () => {
    render(<ObjectPromptPanel prompt={known(promptView({ kind: "Structure", verbs: ["destroy", "garrison"] }))} />);
    expect(screen.getByTestId("delve-object-kind")).toHaveTextContent("Structure");
    expect(screen.getByTestId("delve-object-verb-destroy")).toHaveTextContent("Destroy");
    expect(screen.getByTestId("delve-object-verb-garrison")).toHaveTextContent("Garrison");
  });

  it("never renders the room's own sectorId anywhere", () => {
    render(<ObjectPromptPanel prompt={known(promptView({ sectorId: "s-unique-marker-999" }))} />);
    const root = screen.getByTestId("delve-panel-object");
    expect(root.textContent ?? "").not.toMatch(/s-unique-marker-999/);
  });

  it("offered verbs render as plain tags, never a <button disabled> with no real reason computed", () => {
    render(<ObjectPromptPanel prompt={known(promptView())} />);
    const verbsList = screen.getByTestId("delve-object-verbs");
    expect(verbsList.querySelectorAll("button")).toHaveLength(0);
  });

  it("a one-shot object names itself as such", () => {
    render(<ObjectPromptPanel prompt={known(promptView({ oneShot: true }))} />);
    expect(screen.getByTestId("delve-object-one-shot")).toBeInTheDocument();
  });

  it("a pending prompt (a room is selected, nothing composes it yet) renders its own real reason", () => {
    render(<ObjectPromptPanel prompt={pendingWithReason("What's here isn't shown yet")} />);
    expect(screen.getByTestId("delve-object-fallback")).toHaveTextContent("What's here isn't shown yet");
  });

  it("an absent prompt (no room selected) renders its own honest, distinct copy", () => {
    render(<ObjectPromptPanel prompt={absent()} />);
    expect(screen.getByTestId("delve-object-fallback")).toHaveTextContent("Pick a room first.");
  });

  it("an unrecognised kind or verb id falls back to a named safe word, never the raw id", () => {
    render(<ObjectPromptPanel prompt={known(promptView({ kind: "SomeFutureKind", verbs: ["someFutureVerb"] }))} />);
    expect(screen.getByTestId("delve-object-kind")).toHaveTextContent("Curio");
    expect(screen.getByTestId("delve-object-verb-someFutureVerb")).toHaveTextContent("Do something");
  });
});
