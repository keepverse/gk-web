import { useState } from "react";
import { TabList, type TabItem } from "@/ui";
import type { ActorRungState } from "@/ui/actor";
import { ActorListPickerPanel } from "./ActorListPickerPanel";
import { TypeMultiSelect } from "./TypeMultiSelect";

/**
 * Mirrors `gk-core/src/FusionRpg.Core/Scope/WhoSelector.cs`'s own shape — `Kind` plus exactly the payload
 * field that kind needs. FE-only: no API call, no knowledge of `EffectBag`/grants — this component
 * ships ahead of the commander/aura-skill feature that will eventually consume it (fe-essentials
 * spec-actor-menu-scope-picker.md), the same way `ActorLadderDemoPage.tsx` shipped ahead of Creatures.
 */
export type ScopePickerValue =
  | { kind: "target"; targetPtr: string }
  | { kind: "type"; typeIds: number[] }
  | { kind: "uniqueCreature"; instanceId: string }
  | { kind: "relation"; relation: "ally" | "enemy" };

export type ScopePickerMode = ScopePickerValue["kind"];

/**
 * Target-mode input — ready rows must carry an explicit board/world `targetPtr`.
 * Never derive targetPtr from UniqueActor.instanceId.
 */
export type ScopeTargetCandidate =
  | { kind: "ready"; targetPtr: string; rungState: Extract<ActorRungState, { kind: "ready" }> }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty" };

const MODES: TabItem[] = [
  { id: "target", label: "Target", testId: "scope-mode-target" },
  { id: "type", label: "Type", testId: "scope-mode-type" },
  { id: "uniqueCreature", label: "Specific creature", testId: "scope-mode-unique-creature" },
  { id: "relation", label: "My side / Enemy", testId: "scope-mode-relation" }
];

const RELATION_OPTIONS: Array<{ id: "ally" | "enemy"; label: string }> = [
  { id: "ally", label: "My side (Ally)" },
  { id: "enemy", label: "Enemy" }
];

function RelationPanel({
  value,
  onChange
}: {
  value: Extract<ScopePickerValue, { kind: "relation" }> | null;
  onChange: (value: ScopePickerValue) => void;
}) {
  return (
    <div className="flex gap-2" data-testid="scope-relation-panel" role="radiogroup" aria-label="Relation">
      {RELATION_OPTIONS.map((opt) => {
        const active = value?.relation === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`scope-relation-${opt.id}`}
            onClick={() => {
              console.debug("[fe-essentials] actor-menu-scope-picker: relation selected", { relation: opt.id });
              onChange({ kind: "relation", relation: opt.id });
            }}
            className={`rounded-sm border px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActorMenuScopePicker({
  value,
  onChange,
  targetCandidates = [],
  uniqueCreatureCandidates = [],
  typeOptions = []
}: {
  value: ScopePickerValue | null;
  onChange: (value: ScopePickerValue) => void;
  targetCandidates?: ScopeTargetCandidate[];
  uniqueCreatureCandidates?: ActorRungState[];
  typeOptions?: { typeId: number; label: string }[];
}) {
  const [mode, setMode] = useState<ScopePickerMode>(value?.kind ?? "relation");

  function handleModeChange(id: string) {
    const next = id as ScopePickerMode;
    if (next === mode) return;
    console.debug("[fe-essentials] actor-menu-scope-picker: mode changed", { from: mode, to: next });
    setMode(next);
    // No onChange call here: each panel below only ever reads `value` when `value.kind` matches its
    // own mode (the `value?.kind === "…" ? value : null` guards), so a value shaped for the previous
    // mode already renders as unselected the instant the mode changes — nothing to clear or force.
  }

  return (
    <div data-testid="actor-menu-scope-picker">
      <TabList tabs={MODES} value={mode} onChange={handleModeChange} testId="scope-mode-tabs" />
      <div className="mt-3" data-testid="scope-mode-panel">
        {mode === "relation" ? (
          <RelationPanel value={value?.kind === "relation" ? value : null} onChange={onChange} />
        ) : null}
        {mode === "target" ? (
          <ActorListPickerPanel
            kind="target"
            targetCandidates={targetCandidates}
            value={value?.kind === "target" ? value : null}
            onChange={onChange}
          />
        ) : null}
        {mode === "uniqueCreature" ? (
          <ActorListPickerPanel
            kind="uniqueCreature"
            candidates={uniqueCreatureCandidates}
            value={value?.kind === "uniqueCreature" ? value : null}
            onChange={onChange}
          />
        ) : null}
        {mode === "type" ? (
          <TypeMultiSelect
            options={typeOptions}
            value={value?.kind === "type" ? value.typeIds : []}
            onChange={(typeIds) => onChange({ kind: "type", typeIds })}
          />
        ) : null}
      </div>
    </div>
  );
}
