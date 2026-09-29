import { Fragment } from "react";
import type { GlyphRef, PieceFactory, PiecePayload } from "@/features/gui-lego/types";
import { CatalogIcon } from "@/ui/actor/CatalogIcon";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import { CHART_NEUTRAL_PAINT, DONUT_HOLE_FILL, DONUT_TRACK_FILL, DONUT_TRACK_STROKE } from "@/theme/chartPaint";

type DonutSlice = {
  key: string;
  label: string;
  value: number;
  share: number;
  paint: string;
};

type StackBar = {
  key: string;
  label: string;
  value: number;
  barPct: number;
  sharePct: number;
  valueText: string;
  paint: string;
};

type SourceItem = {
  id?: string;
  sourceId?: string;
  label: string;
  valueText: string;
};

/** Arc paths from contribution slices — paint hex only (never CSS var fills). */
export function donutPathsFromSlices(
  slices: DonutSlice[],
  r = 34,
  c = 40
): { key: string; d: string; fill: string }[] {
  const totalPos = slices.reduce((a, s) => a + s.value, 0) || 1;
  let angle = -90;
  const toRad = (d: number) => (d * Math.PI) / 180;
  return slices.map((s) => {
    const frac = s.value / totalPos;
    const sweep = frac * 360;
    const start = angle;
    angle += sweep;
    const x1 = c + r * Math.cos(toRad(start));
    const y1 = c + r * Math.sin(toRad(start));
    const x2 = c + r * Math.cos(toRad(start + sweep));
    const y2 = c + r * Math.sin(toRad(start + sweep));
    const large = sweep > 180 ? 1 : 0;
    const d =
      sweep >= 359.9
        ? `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.01} ${c - r} Z`
        : `M ${c} ${c} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { key: s.key, d, fill: s.paint };
  });
}

function asSlices(payload: PiecePayload): DonutSlice[] {
  const raw = payload.slices;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s != null && typeof s === "object")
    .map((s) => ({
      key: String(s.key ?? ""),
      label: String(s.label ?? s.key ?? ""),
      value: Number(s.value) || 0,
      share: typeof s.share === "number" ? s.share : 0,
      paint: String(s.paint ?? CHART_NEUTRAL_PAINT)
    }))
    .filter((s) => s.key.length > 0);
}

function asBars(payload: PiecePayload): StackBar[] {
  const raw = payload.bars;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object")
    .map((b) => ({
      key: String(b.key ?? ""),
      label: String(b.label ?? b.key ?? ""),
      value: Number(b.value) || 0,
      barPct: typeof b.barPct === "number" ? b.barPct : 4,
      sharePct: typeof b.sharePct === "number" ? b.sharePct : 0,
      valueText: String(b.valueText ?? ""),
      paint: String(b.paint ?? CHART_NEUTRAL_PAINT)
    }))
    .filter((b) => b.key.length > 0);
}

function asSources(payload: PiecePayload): SourceItem[] {
  const raw = payload.items;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => i != null && typeof i === "object")
    .map((i) => ({
      id: i.id != null ? String(i.id) : undefined,
      sourceId: i.sourceId != null ? String(i.sourceId) : undefined,
      label: String(i.label ?? ""),
      valueText: String(i.valueText ?? "")
    }));
}

function glyphOf(payload: PiecePayload): GlyphRef {
  const g = payload.glyphRef;
  if (g && typeof g === "object") return g as GlyphRef;
  return {};
}

export const channelRowFactory: PieceFactory = ({ payload, bus }) => {
  const channelId = String(payload.channelId ?? "");
  const selected = Boolean(payload.selected);
  const state = String(payload.state ?? "default");
  const kind = String(payload.kind ?? "plain");
  const dim = state === "default" ? " is-dim" : "";
  const on = selected ? " is-on" : "";
  const style = themeStyle(payload);
  const vfx = vfxClass(payload);
  const glyph = glyphOf(payload);
  const glyphColor =
    payload.glyphColor != null && String(payload.glyphColor).length > 0
      ? String(payload.glyphColor)
      : null;
  const variantLabel =
    payload.variantLabel != null && String(payload.variantLabel).length > 0
      ? String(payload.variantLabel)
      : null;

  return (
    <button
      type="button"
      className={`row${dim}${on}${vfx ? ` ${vfx}` : ""}`}
      data-kind={kind}
      data-id={channelId}
      data-testid={`derived-channel-${channelId}`}
      data-state={state}
      style={style}
      onClick={() => bus.emit("derived.channel.select", { channelId })}
    >
      <span className="glyph" aria-hidden="true">
        <CatalogIcon
          icon={glyph.catalogIcon}
          color={glyphColor}
          fallbackToken={glyph.fallbackText ?? glyph.hudToken}
        />
      </span>
      <span>
        <span className="nm">{String(payload.title ?? channelId)}</span>
        <span className="rd">{String(payload.reading ?? "")}</span>
        {variantLabel ? (
          <span
            className="rd"
            style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 9 }}
          >
            {variantLabel}
          </span>
        ) : null}
      </span>
      <span className="val" data-testid={`derived-value-${channelId}`}>
        {String(payload.valueText ?? "—")}
      </span>
      {state === "capped" ? (
        <span className="badge">CAP</span>
      ) : (
        <span className="state-tag">
          {payload.stateLabel != null ? String(payload.stateLabel) : state}
        </span>
      )}
    </button>
  );
};

export const inspectPaneFactory: PieceFactory = ({ payload, slots }) => {
  const style = themeStyle(payload);
  const state = payload.state != null ? String(payload.state) : undefined;
  return (
    <div data-testid="derived-inspector" data-state={state} data-phase={payload.phase} style={style}>
      {slots.hero}
      {slots.meta}
      {slots.cap}
      <div className="contrib" data-testid="derived-contribution-chart">
        <h4>Why this number</h4>
        {slots.gauges}
      </div>
      {slots.sources}
    </div>
  );
};

/** hd + big + reading as sibling roots under inspect-pane (no wrapper). */
export const valueHeroFactory: PieceFactory = ({ payload }) => {
  const glyph = glyphOf(payload);
  const style = themeStyle(payload);
  return (
    <Fragment>
      <div className="hd" style={style}>
        <span className="glyph" aria-hidden="true">
          <CatalogIcon icon={glyph.catalogIcon} fallbackToken={glyph.fallbackText ?? glyph.hudToken} />
        </span>
        <span className="nm">{String(payload.title ?? "")}</span>
      </div>
      <div className="big">{String(payload.valueText ?? "—")}</div>
      {payload.reading != null && String(payload.reading).length > 0 ? (
        <p className="reading">{String(payload.reading)}</p>
      ) : null}
    </Fragment>
  );
};

export const metaSentencesFactory: PieceFactory = ({ payload }) => {
  const sentences = Array.isArray(payload.sentences)
    ? payload.sentences.map((s) => String(s))
    : [];
  if (sentences.length === 0) return null;
  return (
    <Fragment>
      {sentences.map((text, i) => (
        <p key={i} className="sentence">
          {text}
        </p>
      ))}
    </Fragment>
  );
};

export const capNoteFactory: PieceFactory = ({ payload }) => {
  const text = String(payload.text ?? "");
  if (!text) return null;
  const ok = payload.ok !== false && payload.capKind !== "at";
  return <p className={`cap-note${ok ? " ok" : ""}`}>{text}</p>;
};

export const gaugeDonutFactory: PieceFactory = ({ payload }) => {
  const slices = asSlices(payload);
  if (slices.length === 0 || payload.phase === "empty") return null;
  const paths = donutPathsFromSlices(slices);
  return (
    <div className="share-donut" aria-hidden="true" data-testid="derived-share-donut">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="34" fill={DONUT_TRACK_FILL} stroke={DONUT_TRACK_STROKE} strokeWidth="1" />
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill={p.fill} />
        ))}
        <circle cx="40" cy="40" r="18" fill={DONUT_HOLE_FILL} />
      </svg>
      <ul className="share-legend">
        {slices.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.paint }} />
            {s.label} · {s.share}%
          </li>
        ))}
      </ul>
    </div>
  );
};

export const gaugeStackFactory: PieceFactory = ({ payload }) => {
  const bars = asBars(payload);
  return (
    <div className="stack" data-testid="derived-stack">
      {bars.length === 0 ? (
        <p className="rd">No contributions.</p>
      ) : (
        bars.map((b) => (
          <div
            key={b.key}
            className="stack-row"
            data-src={b.key}
            data-testid={`derived-contrib-gauge-${b.key}`}
          >
            <span>{b.label}</span>
            <span className="bar">
              <span
                className="fill"
                style={{ width: `${b.barPct}%`, background: b.paint }}
              />
            </span>
            <span className="share">{b.sharePct}%</span>
            <span className="amt">{b.valueText}</span>
          </div>
        ))
      )}
    </div>
  );
};

export const sourceListFactory: PieceFactory = ({ payload }) => {
  const items = asSources(payload);
  const title = payload.title != null ? String(payload.title) : null;
  return (
    <Fragment>
      {title ? <h4>{title}</h4> : null}
      <ul className="sources" data-testid="derived-sources">
        {items.length === 0 ? (
          <li>
            <span className="lab">Empty</span>
          </li>
        ) : (
          items.map((c, i) => (
            <li key={c.id ?? c.sourceId ?? `${c.label}-${i}`}>
              <span className="lab">{c.label}</span>
              <span className="v">{c.valueText}</span>
            </li>
          ))
        )}
      </ul>
    </Fragment>
  );
};

export const DOMAIN_SLOT_MAP: Record<string, readonly string[]> = {
  "channel-row": [],
  "inspect-pane": ["hero", "meta", "cap", "gauges", "sources"],
  "value-hero": [],
  "meta-sentences": [],
  "cap-note": [],
  "gauge-donut": [],
  "gauge-stack": [],
  "source-list": []
};

export const domainFactories: Record<string, PieceFactory> = {
  "channel-row": channelRowFactory,
  "inspect-pane": inspectPaneFactory,
  "value-hero": valueHeroFactory,
  "meta-sentences": metaSentencesFactory,
  "cap-note": capNoteFactory,
  "gauge-donut": gaugeDonutFactory,
  "gauge-stack": gaugeStackFactory,
  "source-list": sourceListFactory
};
