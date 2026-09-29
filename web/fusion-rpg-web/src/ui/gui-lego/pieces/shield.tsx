import type { CSSProperties } from "react";
import type { PieceFactory } from "@/features/gui-lego/types";
import { resolveElementPaint } from "@/features/gui-lego/themes/elementPaint";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import "../shieldConsole.css";

type SegmentView = {
  shieldId: string;
  elementId: string | null;
  currentText: string;
  maxText: string;
  priorityLabel: string;
  broken: boolean;
  fillPct: number;
  widthPct: number;
  selected: boolean;
  untyped: boolean;
  dataEl: string;
  paintAccent?: string;
  regenText?: string;
};

function asSegments(payload: Record<string, unknown>): SegmentView[] {
  const raw = payload.segments;
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const elementId =
      r.elementId != null && String(r.elementId).length > 0 ? String(r.elementId) : null;
    const paint = elementId ? resolveElementPaint(elementId) : null;
    return {
      shieldId: String(r.shieldId ?? ""),
      elementId,
      currentText: String(r.currentText ?? r.current ?? "0"),
      maxText: String(r.maxText ?? r.max ?? "0"),
      priorityLabel: String(r.priorityLabel ?? ""),
      broken: Boolean(r.broken),
      fillPct: typeof r.fillPct === "number" ? r.fillPct : 0,
      widthPct: typeof r.widthPct === "number" ? r.widthPct : 33,
      selected: Boolean(r.selected),
      untyped: Boolean(r.untyped) || elementId == null,
      dataEl: String(r.dataEl ?? paint?.dataEl ?? "neutral"),
      paintAccent:
        typeof r.paintAccent === "string"
          ? r.paintAccent
          : paint?.paint.accent,
      regenText: r.regenText != null ? String(r.regenText) : undefined
    };
  });
}

export const shieldStackBarFactory: PieceFactory = ({ payload, bus }) => {
  const pending = payload.phase === "pending" || payload.phase === "loading";
  const segments = asSegments(payload as Record<string, unknown>);
  const emptySlots =
    typeof payload.emptySlots === "number" ? Math.max(0, Math.min(3, payload.emptySlots)) : 0;
  const style = themeStyle(payload);
  const vfx = vfxClass(payload);

  return (
    <section
      className={["shield-stack-bar", pending ? "is-pending" : "", vfx].filter(Boolean).join(" ")}
      data-testid="shield-stack-bar"
      data-phase={payload.phase}
      data-grid-area="stack"
      style={style}
    >
      <p className="eyebrow">Shield stack</p>
      {pending ? (
        <p className="pending-copy" data-testid="actor-shield-pending">
          {String(payload.message ?? "Shield details aren't ready yet")}
        </p>
      ) : null}
      <div className="track" role="list">
        {segments.map((seg) => {
          const accent = seg.paintAccent;
          return (
            <button
              type="button"
              key={seg.shieldId}
              role="listitem"
              className={[
                "shield-segment",
                seg.selected ? "is-on" : "",
                seg.broken ? "is-broken" : "",
                seg.untyped ? "is-untyped" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid={`shield-segment-${seg.shieldId}`}
              data-el={seg.dataEl}
              data-broken={seg.broken || undefined}
              style={
                {
                  flex: `${seg.widthPct} 1 0`,
                  ["--piece-accent" as string]: accent
                } as CSSProperties
              }
              onClick={() => bus.emit("shield.layer.select", { shieldId: seg.shieldId })}
            >
              <span className="fill" style={{ width: `${seg.broken ? 0 : seg.fillPct}%` }} />
              <span className="meta">
                <span className="prio">{seg.priorityLabel}</span>
                <span className="hp">
                  {seg.currentText} / {seg.maxText}
                </span>
                {seg.regenText ? <span className="regen">{seg.regenText}</span> : null}
              </span>
            </button>
          );
        })}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div
            key={`empty-${i}`}
            className="shield-empty-slot"
            data-testid={`shield-empty-slot-${i + 1}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  );
};

export const shieldLayerInspectFactory: PieceFactory = ({ payload, bus }) => {
  const phase = String(payload.phase ?? "ready");
  const style = themeStyle(payload);
  const vfx = vfxClass(payload);
  const elementId =
    payload.elementId != null && String(payload.elementId).length > 0
      ? String(payload.elementId)
      : null;
  const paint = elementId ? resolveElementPaint(elementId) : null;
  const accent = payload.themeResolved?.paint?.accent ?? paint?.paint.accent;
  const pendingTestId =
    payload.testId != null
      ? String(payload.testId)
      : undefined;

  if (phase === "pending" || phase === "loading" || phase === "empty" || phase === "error") {
    return (
      <section
        className={["shield-layer-inspect", `is-${phase}`, vfx].filter(Boolean).join(" ")}
        data-testid="shield-layer-inspect"
        data-phase={phase}
        data-grid-area="inspect"
        style={
          {
            ...style,
            ["--piece-accent" as string]: accent
          } as CSSProperties
        }
      >
        <p className="eyebrow">Selected layer</p>
        <p className="pending-copy" data-testid={pendingTestId}>
          {String(payload.message ?? (phase === "empty" ? "No shield layer selected" : "Not ready yet."))}
        </p>
        {phase === "error" && payload.canRetry !== false ? (
          <button type="button" onClick={() => bus.emit(String(payload.retryEvent ?? "shield.retry"), {})}>
            {String(payload.retryLabel ?? "Retry")}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={["shield-layer-inspect", vfx].filter(Boolean).join(" ")}
      data-testid="shield-layer-inspect"
      data-phase={phase}
      data-el={paint?.dataEl}
      data-grid-area="inspect"
      style={
        {
          ...style,
          ["--piece-accent" as string]: accent
        } as CSSProperties
      }
    >
      <p className="eyebrow">Selected layer</p>
      <p className="title">{String(payload.title ?? "Shield")}</p>
      <p className="hp">
        {String(payload.currentText ?? "—")} / {String(payload.maxText ?? "—")}
      </p>
      <div className="meta">
        <span>
          Priority · <b>{String(payload.priorityLabel ?? "—")}</b>
        </span>
        <span>
          Source · <b>{String(payload.sourceLabel ?? "—")}</b>
        </span>
        {payload.elementLabel ? (
          <span>
            Element · <b>{String(payload.elementLabel)}</b>
          </span>
        ) : null}
        {payload.regenText ? (
          <span>
            Regen · <b>{String(payload.regenText)}</b>
          </span>
        ) : null}
      </div>
    </section>
  );
};

export const shieldOmniRegionFactory: PieceFactory = ({ payload, slots }) => {
  const style = themeStyle(payload);
  return (
    <section
      className="shield-omni-region"
      data-testid="shield-omni-region"
      data-phase={payload.phase}
      data-grid-area="omni"
      style={style}
    >
      <p className="eyebrow">{String(payload.title ?? "Shield stats")}</p>
      {payload.message && payload.phase !== "ready" ? (
        <p className="pending-copy">{String(payload.message)}</p>
      ) : null}
      <div className="omni-rows">{slots.rows}</div>
    </section>
  );
};

export const SHIELD_SLOT_MAP: Record<string, readonly string[]> = {
  "shield-stack-bar": [],
  "shield-layer-inspect": [],
  "shield-omni-region": ["rows"]
};

export const shieldFactories: Record<string, PieceFactory> = {
  "shield-stack-bar": shieldStackBarFactory,
  "shield-layer-inspect": shieldLayerInspectFactory,
  "shield-omni-region": shieldOmniRegionFactory
};
