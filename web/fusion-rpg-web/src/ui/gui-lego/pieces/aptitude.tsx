import type { PieceFactory } from "@/features/gui-lego/types";
import { CatalogIcon } from "@/ui/actor/CatalogIcon";
import { LeftoverBar } from "@/ui/actor/LeftoverBar";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { CHART_NEUTRAL_PAINT } from "@/theme/chartPaint";
import { ruleLabel } from "@/features/aptitudes/autoAssign";

export const aptitudeScopeChipFactory: PieceFactory = ({ payload }) => {
  const style = themeStyle(payload);
  return (
    <p
      className="text-xs text-muted"
      data-testid="aptitudes-scope-chip"
      data-scope={String(payload.scopeKey ?? "")}
      style={style}
    >
      Scope: {String(payload.title ?? "")}
      {payload.subtitle != null && String(payload.subtitle).length > 0
        ? ` · ${String(payload.subtitle)}`
        : null}
      {payload.commanderAddOn != null && String(payload.commanderAddOn).length > 0 ? (
        <span className="mt-0.5 block" data-testid="aptitudes-scope-commander-addon">
          {String(payload.commanderAddOn)}
        </span>
      ) : null}
    </p>
  );
};

export const leftoverGaugeFactory: PieceFactory = ({ payload }) => {
  const budget = Number(payload.budget) || 0;
  const spent = Number(payload.spent) || 0;
  const overspend = Boolean(payload.overspend) || spent > budget;
  return (
    <div
      className={overspend ? "animate-pulse" : undefined}
      data-testid="leftover-gauge"
      data-revision={payload.revision != null ? String(payload.revision) : undefined}
    >
      <LeftoverBar budget={budget} spent={spent} testId="leftover-gauge-bar" />
    </div>
  );
};

export const allocateDecisionStripFactory: PieceFactory = ({ payload, bus }) => {
  const dirty = Boolean(payload.dirty);
  const withinBudget = Boolean(payload.withinBudget);
  const saving = Boolean(payload.saving);
  const priceAmount = typeof payload.priceAmount === "number" ? payload.priceAmount : null;
  const priceResource =
    payload.priceResource != null && String(payload.priceResource).length > 0
      ? String(payload.priceResource)
      : null;
  return (
    <div
      className="flex w-full flex-wrap items-center justify-between gap-2"
      data-testid="allocate-decision-strip"
    >
      {priceAmount != null && priceResource ? (
        <span className="text-xs text-muted" data-testid="allocate-decision-price">
          Respec cost: {priceAmount} {priceResource}
        </span>
      ) : (
        <span className="text-xs text-muted" data-testid="allocate-decision-hint">
          Confirm commits this draft · Cancel discards
        </span>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-sm border border-border-control px-2 py-1 text-sm text-text"
          data-testid="allocate-decision-cancel"
          disabled={!dirty || saving}
          title={saving ? "Saving…" : !dirty ? "No unsaved changes to cancel" : undefined}
          onClick={() => bus.emit("aptitude.reset", {})}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-sm border border-lawn-hot bg-lawn/20 px-2 py-1 text-sm text-text"
          data-testid={
            payload.confirmTestId != null && String(payload.confirmTestId).length > 0
              ? String(payload.confirmTestId)
              : "allocate-decision-confirm"
          }
          disabled={!dirty || !withinBudget || saving}
          title={
            saving
              ? "Saving…"
              : !dirty
                ? "No unsaved changes to confirm"
                : !withinBudget
                  ? "Over budget — reduce points spent before confirming"
                  : undefined
          }
          onClick={() => bus.emit("aptitude.confirm", {})}
        >
          {saving ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
};

export const presetEntryFactory: PieceFactory = ({ payload, bus }) => {
  const active =
    payload.activePresetName != null && String(payload.activePresetName).length > 0
      ? String(payload.activePresetName)
      : null;
  return (
    <button
      type="button"
      className="rounded-sm border border-border-control px-2 py-1 text-xs text-text"
      data-testid="preset-entry"
      onClick={() => bus.emit("preset.open", {})}
    >
      {String(payload.label ?? "Aptitude presets…")}
      {active ? <span className="ml-2 text-muted">· {active}</span> : null}
    </button>
  );
};

/**
 * spec-auto-assign-control.md (EP1.20) — the producer for `aptitude.autoAssign`. `payload.rules`
 * is the server-listed rule set for this scope (`GET /api/aptitude-presets/rules`, C1) — never a
 * hardcoded FE list; Mode C already omits `species-favour` server-side (C5), so no client-side
 * hiding logic lives here. C2: clicking emits `aptitude.autoAssign` with that rule and nothing
 * else. C4's named-reason refusal is handled reactively by the existing bus handler (a toast on
 * refusal, `even` always present in `rules` as the guaranteed fallback) — this piece never
 * pre-flights a rule's legality, since only `active-preset` can refuse and only at apply time.
 */
export const autoAssignRuleStripFactory: PieceFactory = ({ payload, bus }) => {
  const rules = Array.isArray(payload.rules) ? (payload.rules as string[]) : [];
  if (rules.length === 0) return null;
  const saving = Boolean(payload.saving);
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="auto-assign-rule-strip">
      {rules.map((ruleId) => (
        <button
          key={ruleId}
          type="button"
          className="rounded-sm border border-border-control px-2 py-1 text-xs text-text disabled:opacity-40"
          data-testid={`auto-assign-rule-${ruleId}`}
          disabled={saving}
          title={saving ? "Saving…" : undefined}
          onClick={() => bus.emit("aptitude.autoAssign", { rule: ruleId })}
        >
          {ruleLabel(ruleId)}
        </button>
      ))}
    </div>
  );
};

export const postureBandFactory: PieceFactory = ({ payload, slots }) => {
  const style = themeStyle(payload);
  const vfx = vfxClass(payload);
  const postureId = String(payload.postureId ?? "");
  return (
    <section
      className={["rounded-sm border border-border-control p-2", vfx].filter(Boolean).join(" ")}
      aria-label={String(payload.displayName ?? postureId)}
      data-testid={`aptitude-posture-${postureId}`}
      style={style}
    >
      <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted">
        {String(payload.displayName ?? postureId)}
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{slots.tiles}</div>
    </section>
  );
};

export const aptitudeTileFactory: PieceFactory = ({ payload, bus }) => {
  const style = themeStyle(payload);
  const vfx = vfxClass(payload);
  const id = String(payload.aptitudeId ?? "");
  const displayName = String(payload.displayName ?? id);
  const selected = Boolean(payload.selected);
  const value = Number(payload.value) || 0;
  const icon = payload.icon != null ? String(payload.icon) : null;
  return (
    <div
      data-testid={`aptitude-tile-${id}`}
      data-selected={selected ? "true" : "false"}
      className={[
        "rounded-sm border p-3",
        selected ? "border-lawn-hot bg-lawn/15" : "border-border-control bg-panel-inset",
        vfx
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => bus.emit("aptitude.select", { aptitudeId: id })}
      >
        <span className="mb-1 flex items-center gap-2">
          <CatalogIcon
            icon={icon}
            fallbackToken={displayName.slice(0, 2)}
            testId={`aptitude-icon-${id}`}
          />
          <span className="block font-ui text-sm text-text">{displayName}</span>
        </span>
        <span className="block font-mono text-lg text-text" data-testid={`aptitude-value-${id}`}>
          {value}
        </span>
      </button>
      {payload.allowDirectEdit ? (
        <input
          type="number"
          min={0}
          className="mt-1 w-full rounded-sm border border-border-control bg-panel px-2 py-1 font-mono text-sm text-text"
          data-testid={`species-build-input-${id}`}
          value={value}
          onChange={(e) =>
            bus.emit("aptitude.set", { aptitudeId: id, value: Number(e.target.value) || 0 })
          }
        />
      ) : null}
      <div className="mt-2 flex gap-1">
        <button
          type="button"
          className="rounded-sm border border-border-control px-2 py-0.5 text-sm text-text"
          data-testid={`aptitude-dec-${id}`}
          aria-label={`Decrease ${displayName}`}
          onClick={() => bus.emit("aptitude.step", { aptitudeId: id, delta: -1 })}
        >
          −
        </button>
        <button
          type="button"
          className="rounded-sm border border-border-control px-2 py-0.5 text-sm text-text"
          data-testid={`aptitude-inc-${id}`}
          aria-label={`Increase ${displayName}`}
          onClick={() => bus.emit("aptitude.step", { aptitudeId: id, delta: 1 })}
        >
          +
        </button>
      </div>
    </div>
  );
};

export const aptitudeInspectFactory: PieceFactory = ({ payload }) => {
  const families = Array.isArray(payload.fedFamilies)
    ? (payload.fedFamilies as { displayName?: string }[])
    : [];
  const name = String(payload.displayName ?? "");
  if (!name) {
    return (
      <p className="text-xs italic text-muted" data-testid="aptitude-inspect-empty">
        Select an aptitude.
      </p>
    );
  }
  return (
    <div data-testid="aptitude-inspect">
      <h3 className="font-display text-base text-text">{name}</h3>
      <p className="text-sm text-muted">{String(payload.reading ?? "")}</p>
      <p className="text-xs text-muted">{String(payload.role ?? "")}</p>
      {families.length > 0 ? (
        <ul className="mt-2 space-y-0.5" data-testid="aptitude-inspect-fed">
          {families.map((f, i) => (
            <li key={`${f.displayName ?? i}`} className="text-xs text-text">
              {String(f.displayName ?? "")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export const speciesBuildChromeFactory: PieceFactory = ({ payload }) => {
  const hasOverride = Boolean(payload.hasOverride);
  const priceAmount = typeof payload.priceAmount === "number" ? payload.priceAmount : null;
  const priceResource =
    payload.priceResource != null && String(payload.priceResource).length > 0
      ? String(payload.priceResource)
      : null;
  const statusMessage =
    payload.statusMessage != null && String(payload.statusMessage).length > 0
      ? String(payload.statusMessage)
      : hasOverride
        ? "You've overridden the shipped build below."
        : "You're running the shipped build.";
  return (
    <div
      className="rounded-sm border border-border-control bg-panel-inset p-2 text-xs text-muted"
      data-testid="species-build-chrome"
      data-has-override={hasOverride ? "true" : "false"}
    >
      <p data-testid="species-build-status">{statusMessage}</p>
      {priceAmount != null && priceResource ? (
        <p data-testid="species-build-price">
          Next Confirm / Activate costs {priceAmount} {priceResource}
        </p>
      ) : (
        <p data-testid="species-build-free">First override / revert is free</p>
      )}
    </div>
  );
};

export const aptitudesLayoutFactory: PieceFactory = ({ payload, slots }) => {
  const style = themeStyle(payload);
  return (
    <div
      className="mt-4 flex min-h-0 flex-col gap-3"
      data-testid="aptitudes-tab"
      data-mode={String(payload.mode ?? "")}
      style={style}
    >
      <div className="flex flex-wrap items-center gap-3" data-testid="aptitudes-hero">
        {slots.hero}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="space-y-4" data-testid="aptitudes-bands">
          {slots.bands}
        </div>
        <aside className="min-w-0" data-testid="aptitudes-inspect-slot">
          {slots.inspect}
        </aside>
      </div>
      <div data-testid="aptitudes-decision-slot">{slots.decision}</div>
    </div>
  );
};

type DonutSeg = { key: string; name: string; value: number; fill: string };

export const presetDistributionChartFactory: PieceFactory = ({ payload }) => {
  const raw = Array.isArray(payload.segments) ? (payload.segments as Record<string, unknown>[]) : [];
  const segments: DonutSeg[] = raw
    .map((s) => ({
      key: String(s.aptitudeId ?? s.key ?? ""),
      name: String(s.displayName ?? s.aptitudeId ?? ""),
      value: Number(s.permille ?? s.points ?? s.value) || 0,
      fill: String(s.paint ?? CHART_NEUTRAL_PAINT)
    }))
    .filter((s) => s.key.length > 0 && s.value > 0);
  if (segments.length === 0) {
    return (
      <div className="text-xs italic text-muted" data-testid="preset-distribution-chart-empty">
        No distribution yet — assign shares or open a preset.
      </div>
    );
  }
  return (
    <div className="h-40 w-full" data-testid="preset-distribution-chart" data-revision={String(payload.revision ?? "")}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={28}
            outerRadius={48}
            isAnimationActive={false}
          >
            {segments.map((s) => (
              <Cell key={s.key} fill={s.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const presetConsoleLayoutFactory: PieceFactory = ({ payload, slots }) => {
  const style = themeStyle(payload);
  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-[12rem_minmax(0,1fr)_11rem]"
      data-testid="aptitude-preset-console"
      data-mode={String(payload.mode ?? "")}
      style={style}
    >
      <div className="min-h-0 md:max-h-[50vh] md:overflow-y-auto xl:max-h-none" data-testid="preset-gallery-slot">
        {slots.gallery}
      </div>
      <div className="min-h-0 max-h-[45vh] overflow-y-auto md:max-h-[55vh]" data-testid="preset-editor-slot">
        {slots.editor}
      </div>
      <div
        className="flex min-h-0 flex-col gap-2 md:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-start-1"
        data-testid="preset-chart-slot"
      >
        {slots.chart}
      </div>
    </div>
  );
};

export const presetGalleryFactory: PieceFactory = ({ payload, bus }) => {
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  return (
    <div data-testid="preset-gallery" className="space-y-2">
      <p className="text-2xs font-bold uppercase tracking-wide text-muted">Gallery</p>
      <ul className="space-y-1">
        {items.map((item) => {
          const id = String(item.presetId ?? "");
          const selected = Boolean(item.selected);
          const active = Boolean(item.active);
          return (
            <li key={id}>
              <button
                type="button"
                className={[
                  "w-full rounded-sm border px-2 py-1.5 text-left text-xs",
                  selected
                    ? "border-lawn-hot bg-lawn/15 text-text"
                    : "border-border-control bg-panel-inset text-text"
                ].join(" ")}
                data-testid={`preset-gallery-item-${id}`}
                data-selected={selected ? "true" : "false"}
                data-active={active ? "true" : "false"}
                onClick={() => bus.emit("preset.select", { presetId: id })}
              >
                <span className="font-ui">{String(item.name ?? id)}</span>
                {active ? <span className="ml-1 text-muted">· active</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {payload.canNew ? (
        <button
          type="button"
          className="w-full rounded-sm border border-dashed border-border-control px-2 py-1.5 text-xs text-muted"
          data-testid="preset-gallery-new"
          onClick={() => bus.emit("preset.new", {})}
        >
          + New preset
        </button>
      ) : null}
    </div>
  );
};

export const presetEditorFactory: PieceFactory = ({ payload, bus }) => {
  const rows = Array.isArray(payload.rows) ? (payload.rows as Record<string, unknown>[]) : [];
  const sumOk = Boolean(payload.sumOk);
  const permilleSum = Number(payload.permilleSum) || 0;
  return (
    <div data-testid="preset-editor" className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-2xs text-muted">
          Name
          <input
            type="text"
            className="rounded-sm border border-border-control bg-panel px-2 py-1 font-ui text-sm text-text"
            data-testid="preset-editor-name"
            value={String(payload.name ?? "")}
            onChange={(e) => bus.emit("preset.name.set", { name: e.target.value })}
          />
        </label>
        <p
          className={sumOk ? "text-xs text-muted" : "text-xs text-warn"}
          data-testid="preset-editor-sum"
          data-sum-ok={sumOk ? "true" : "false"}
        >
          pm sum {permilleSum} {sumOk ? "(ok)" : "(need 1000)"}
        </p>
      </div>
      <div className="space-y-1" data-testid="preset-editor-rows">
        {rows.map((row) => {
          const id = String(row.aptitudeId ?? "");
          return (
            <div
              key={id}
              className="grid grid-cols-[minmax(4.5rem,1fr)_repeat(5,minmax(2.75rem,3.25rem))] items-center gap-1 border-b border-border/40 py-1 text-2xs"
              data-testid={`preset-editor-row-${id}`}
            >
              <span className="truncate text-text" title={String(row.displayName ?? id)}>
                {String(row.displayName ?? id)}
              </span>
              {(
                [
                  ["targetPermille", "pm", row.targetPermille],
                  ["minAbs", "lo", row.minAbs],
                  ["maxAbs", "hi", row.maxAbs],
                  ["minPermille", "loP", row.minPermille],
                  ["maxPermille", "hiP", row.maxPermille]
                ] as const
              ).map(([field, label, value]) => (
                <label key={field} className="flex flex-col gap-0.5 text-muted">
                  <span>{label}</span>
                  <input
                    type="number"
                    className="w-full rounded-sm border border-border-control bg-panel px-1 py-0.5 font-mono text-text"
                    data-testid={`preset-editor-${field}-${id}`}
                    value={value === "" || value == null ? "" : Number(value)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      bus.emit("preset.row.set", {
                        aptitudeId: id,
                        field,
                        value: raw === "" ? null : Number(raw) || 0
                      });
                    }}
                  />
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const presetActionStripFactory: PieceFactory = ({ payload, bus }) => {
  const price =
    payload.activatePriceLabel != null && String(payload.activatePriceLabel).length > 0
      ? String(payload.activatePriceLabel)
      : null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
      data-testid="preset-action-strip"
    >
      <button
        type="button"
        className="rounded-sm border border-border-control px-3 py-1.5 text-xs text-text disabled:opacity-40"
        data-testid="preset-apply-draft"
        disabled={!payload.applyEnabled}
        title={
          payload.applyEnabled
            ? undefined
            : payload.saving
              ? "Saving…"
              : "Select a preset with shares summing to 100% first"
        }
        onClick={() => bus.emit("preset.applyDraft", {})}
      >
        Apply to draft
      </button>
      <button
        type="button"
        className="rounded-sm border border-lawn-hot bg-lawn/20 px-3 py-1.5 text-xs text-text disabled:opacity-40"
        data-testid="preset-activate"
        disabled={!payload.activateEnabled}
        title={
          payload.activateEnabled
            ? undefined
            : payload.activating
              ? "Activating…"
              : "Select a preset with shares summing to 100% first"
        }
        onClick={() => bus.emit("preset.activate", {})}
      >
        Activate
      </button>
      {price ? (
        <span className="text-xs text-muted" data-testid="preset-activate-price">
          {price}
        </span>
      ) : null}
      <button
        type="button"
        className="rounded-sm border border-border-control px-3 py-1.5 text-xs text-text disabled:opacity-40"
        data-testid="preset-save"
        disabled={!payload.saveEnabled}
        title={
          payload.saveEnabled
            ? undefined
            : payload.saving
              ? "Saving…"
              : "Enter a name and make sure shares sum to 100% first"
        }
        onClick={() => bus.emit("preset.save", {})}
      >
        {payload.saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="rounded-sm border border-border-control px-3 py-1.5 text-xs text-muted disabled:opacity-40"
        data-testid="preset-delete"
        disabled={!payload.deleteEnabled}
        title={
          payload.deleteEnabled ? undefined : payload.saving ? "Saving…" : "Select a preset first"
        }
        onClick={() => bus.emit("preset.delete", {})}
      >
        Delete
      </button>
      <button
        type="button"
        className="ml-auto rounded-sm border border-border-control px-3 py-1.5 text-xs text-muted"
        data-testid="preset-close"
        onClick={() => bus.emit("preset.close", {})}
      >
        Close
      </button>
    </div>
  );
};

export const aptitudeFactories: Record<string, PieceFactory> = {
  "aptitude-scope-chip": aptitudeScopeChipFactory,
  "leftover-gauge": leftoverGaugeFactory,
  "allocate-decision-strip": allocateDecisionStripFactory,
  "preset-entry": presetEntryFactory,
  "auto-assign-rule-strip": autoAssignRuleStripFactory,
  "posture-band": postureBandFactory,
  "aptitude-tile": aptitudeTileFactory,
  "aptitude-inspect": aptitudeInspectFactory,
  "species-build-chrome": speciesBuildChromeFactory,
  "aptitudes-layout": aptitudesLayoutFactory,
  "preset-distribution-chart": presetDistributionChartFactory,
  "preset-console-layout": presetConsoleLayoutFactory,
  "preset-gallery": presetGalleryFactory,
  "preset-editor": presetEditorFactory,
  "preset-action-strip": presetActionStripFactory
};

export const APTITUDE_SLOT_MAP: Record<string, readonly string[]> = {
  "aptitude-scope-chip": [],
  "leftover-gauge": [],
  "allocate-decision-strip": [],
  "preset-entry": [],
  "auto-assign-rule-strip": [],
  "posture-band": ["tiles"],
  "aptitude-tile": [],
  "aptitude-inspect": [],
  "species-build-chrome": [],
  "aptitudes-layout": ["hero", "bands", "inspect", "decision"],
  "preset-distribution-chart": [],
  "preset-console-layout": ["gallery", "editor", "chart"],
  "preset-gallery": [],
  "preset-editor": [],
  "preset-action-strip": []
};
