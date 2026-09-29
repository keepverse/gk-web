import { lazy, Suspense, type CSSProperties } from "react";
import type { PieceFactory, PiecePayload } from "@/features/gui-lego/types";
import { CatalogIcon } from "@/ui/actor/CatalogIcon";
import { StatusGlyph } from "@/ui/actor/StatusGlyph";
import { TypeIcon } from "@/ui";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import type { StatusCatalogRow } from "@/contract/actorSurface";
import { CHART_NEUTRAL_PAINT } from "@/theme/chartPaint";
import "../conditionConsole.css";

const StandingRadarChart = lazy(() => import("./StandingRadarChart"));

type Axis = {
  id: string;
  label: string;
  value: number;
  valueText: string;
  fillPct: number;
  paint: string;
};

function axisList(payload: Record<string, unknown>): Axis[] {
  const raw = payload.axes;
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const value = Number(r.value ?? 0);
    const fillPct = typeof r.fillPct === "number" ? Number(r.fillPct) : value;
    return {
      id: String(r.id ?? ""),
      label: String(r.label ?? ""),
      value,
      valueText: String(r.valueText ?? value),
      fillPct,
      paint: String(r.paint ?? CHART_NEUTRAL_PAINT)
    };
  });
}

function revisionOf(payload: PiecePayload): number {
  return typeof payload.revision === "number" ? payload.revision : 0;
}

function accentFrom(payload: PiecePayload, fallback: string): string {
  return payload.themeResolved?.paint?.accent ?? fallback;
}

export const condHeroFactory: PieceFactory = ({ slots }) => (
  <section className="cond-hero" data-testid="condition-hero" data-grid-area="hero">
    <div className="hero-radial-stack">
      {slots.radial}
      {slots.shield}
    </div>
    <div className="pool-col">{slots.meters}</div>
  </section>
);

export const poolRadialFactory: PieceFactory = ({ payload, bus }) => {
  const hpPending = payload.hpPct == null;
  const shieldKnown = typeof payload.shieldPct === "number" && Number(payload.shieldPct) > 0;
  const hpPct = typeof payload.hpPct === "number" ? payload.hpPct : 0;
  const shieldPct = typeof payload.shieldPct === "number" ? payload.shieldPct : 0;
  const revision = revisionOf(payload);
  const hpColor = accentFrom(payload, "var(--color-bad)");
  const shieldColor =
    payload.shieldThemeResolved?.paint?.accent ??
    (payload.shieldColor != null ? String(payload.shieldColor) : "var(--color-sun)");
  const vfx = vfxClass(payload);
  const style = themeStyle(payload);

  return (
    <button
      type="button"
      className={["radial-wrap", hpPending ? "is-pending" : null, vfx].filter(Boolean).join(" ")}
      data-testid="condition-hp-radial"
      data-pending={hpPending || undefined}
      data-revision={revision}
      style={style}
      onClick={() => bus.emit("condition.pool.select", { poolId: "hp" })}
      title={String(payload.valueText ?? "HP")}
    >
      {shieldKnown ? (
        <div
          key={`shield-${revision}-${shieldPct}`}
          className="radial radial-shield"
          style={
            {
              width: 96,
              height: 96,
              ["--p" as string]: shieldPct,
              ["--c" as string]: shieldColor
            } as CSSProperties
          }
        />
      ) : null}
      <div
        key={`hp-${revision}-${hpPct}`}
        className="radial radial-hp"
        style={
          {
            width: 72,
            height: 72,
            ["--p" as string]: hpPct,
            ["--c" as string]: hpColor
          } as CSSProperties
        }
      />
      <span className="n">HP</span>
    </button>
  );
};

export const poolMeterFactory: PieceFactory = ({ payload, bus }) => {
  const label = String(payload.label ?? "");
  const fillPending = payload.fillPct == null;
  const fillPct = typeof payload.fillPct === "number" ? payload.fillPct : null;
  const selected = Boolean(payload.selected);
  const poolId = String(payload.poolId ?? "");
  const revision = revisionOf(payload);
  const icon = payload.icon != null ? String(payload.icon) : null;
  const accent = accentFrom(payload, "var(--lawn-hot, var(--sun))");
  const vfx = vfxClass(payload);
  const style = themeStyle(payload);

  return (
    <button
      type="button"
      className={["meter", selected ? "is-on" : null, fillPending ? "is-pending" : null, vfx]
        .filter(Boolean)
        .join(" ")}
      data-pool={poolId}
      data-testid={`condition-resource-${poolId}`}
      data-pending={fillPending || undefined}
      data-revision={revision}
      style={style}
      onClick={() => bus.emit("condition.pool.select", { poolId })}
    >
      <span className="cap">
        <span className="cap-label">
          {icon ? (
            <CatalogIcon
              icon={icon}
              fallbackToken={label.slice(0, 1)}
              color={accent}
              className="meter-icon"
              testId={`condition-resource-icon-${poolId}`}
            />
          ) : null}
          <span>{label}</span>
        </span>
        <b>{String(payload.valueText ?? "Current / max pending")}</b>
      </span>
      <span className="track">
        {fillPct != null ? (
          <span
            key={`fill-${revision}`}
            className="fill"
            style={{ width: `${fillPct}%`, background: accent }}
          />
        ) : null}
      </span>
    </button>
  );
};

export const progressionGaugeFactory: PieceFactory = ({ payload }) => {
  const fillPending = payload.fillPct == null;
  const fillPct = typeof payload.fillPct === "number" ? payload.fillPct : null;
  const revision = revisionOf(payload);
  const accent = accentFrom(payload, "var(--sun)");
  const vfx = vfxClass(payload);
  const style = themeStyle(payload);

  return (
    <section
      className={["progression-gauge", fillPending ? "is-pending" : null, vfx]
        .filter(Boolean)
        .join(" ")}
      data-testid="condition-progression"
      data-grid-area="prog"
      data-pending={fillPending || undefined}
      data-revision={revision}
      style={style}
    >
      <div className="hd">
        <span className="eyebrow">Current progression</span>
        <span className="level">Lv {String(payload.level ?? "—")}</span>
      </div>
      <div className="xp-line">
        <b data-testid="condition-xp-count">{String(payload.valueText ?? "—")}</b>
      </div>
      <div className="track" data-testid="condition-xp-track">
        {fillPct != null ? (
          <div
            key={`xp-${revision}`}
            className="fill"
            data-testid="condition-xp-fill"
            style={{ width: `${Math.max(0, Math.min(100, fillPct))}%`, background: accent }}
          />
        ) : null}
      </div>
      {payload.message ? (
        <p className="pending-copy" data-testid="condition-xp-pending">
          {String(payload.message)}
        </p>
      ) : null}
    </section>
  );
};

export const standRowFactory: PieceFactory = ({ payload, slots }) => (
  <section className="stand-row" data-testid="condition-standing" data-grid-area="stand">
    {payload.combatPowerText != null ? (
      <p className="spec-label" data-testid="condition-combat-power">
        Combat power: {String(payload.combatPowerText)}
      </p>
    ) : null}
    {slots.radar}
    <div className="live-col">{slots.live}</div>
  </section>
);

export const standingRadarFactory: PieceFactory = ({ payload }) => {
  const revision = revisionOf(payload);
  if (payload.phase === "pending") {
    return (
      <div
        className="radar-box"
        data-testid="condition-standing-radar"
        data-revision={revision}
      >
        <p className="pending-copy" data-testid="actor-standing-pending">
          {String(payload.message ?? "Standing vector isn't ready yet.")}
        </p>
      </div>
    );
  }
  const axes = axisList(payload as Record<string, unknown>);
  return (
    <div
      className="radar-box"
      data-testid="condition-standing-radar"
      data-revision={revision}
    >
      <Suspense
        fallback={
          <div className="radar-fallback" data-testid="standing-radar-fallback" aria-hidden>
            …
          </div>
        }
      >
        <StandingRadarChart axes={axes} revision={revision} />
      </Suspense>
    </div>
  );
};

export const standingBarsFactory: PieceFactory = ({ payload }) => {
  const title = String(payload.title ?? "Standing");
  const revision = revisionOf(payload);
  if (payload.phase === "pending") {
    return (
      <div data-testid="condition-standing-bars" data-revision={revision}>
        <p className="spec-label">{title}</p>
        <p className="pending-copy">{String(payload.message ?? "Standing vector isn't ready yet.")}</p>
      </div>
    );
  }
  const axes = axisList(payload as Record<string, unknown>);
  return (
    <div data-testid="condition-standing-bars" data-revision={revision}>
      <p className="spec-label">{title}</p>
      <div className="pw">
        {axes.map((axis) => (
          <div className="bar" key={axis.id} data-c={axis.id}>
            <span>{axis.label}</span>
            <span className="t">
              <span
                key={`bar-${axis.id}-${revision}`}
                className="f"
                style={{ width: `${axis.fillPct}%`, background: axis.paint }}
              />
            </span>
            <b>{axis.valueText}</b>
          </div>
        ))}
      </div>
    </div>
  );
};

export const statusGlyphStripFactory: PieceFactory = ({ payload, bus }) => {
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  const isPending = payload.phase === "pending";
  // Q3 — omit empty chrome when fold left strip unbound or zero live rows.
  if (!isPending && items.length === 0) return null;
  const revision = revisionOf(payload);

  return (
    <div
      className="status-strip"
      data-testid="condition-status-strip"
      data-revision={revision}
    >
      <p className="spec-label">{String(payload.title ?? "Effects")}</p>
      <div className="glyph-wrap" data-testid="condition-live-effects">
        {items.map((item) => {
          const status: StatusCatalogRow = {
            id: String(item.id ?? ""),
            displayName: String(item.label ?? item.id ?? ""),
            reading: String(item.label ?? item.id ?? ""),
            hudToken: String(item.hudToken ?? item.id ?? "?"),
            color: String(item.color ?? "var(--color-ok)")
          };
          return (
            <StatusGlyph
              key={status.id}
              status={status}
              live
              testId={`status-glyph-${status.id}`}
              onSelect={() => bus.emit("condition.status.open", { statusId: status.id })}
            />
          );
        })}
        {typeof payload.overflowCount === "number" && payload.overflowCount > 0 ? (
          <span className="tag">+{payload.overflowCount}</span>
        ) : null}
      </div>
      {payload.message ? (
        <p className="pending-copy" data-testid="condition-live-effects-pending">
          {String(payload.message)}
        </p>
      ) : null}
    </div>
  );
};

export const actorIdentityFactory: PieceFactory = ({ payload, slots }) => {
  const species = payload.speciesName != null ? String(payload.speciesName) : null;
  const pending = payload.phase === "pending";
  const side = String(payload.side ?? "plant") as "plant" | "zombie";
  const typeId = typeof payload.typeId === "number" ? payload.typeId : 0;
  const speciesMessage =
    payload.speciesMessage != null
      ? String(payload.speciesMessage)
      : payload.message != null
        ? String(payload.message)
        : null;

  return (
    <section
      className={`actor-identity${pending ? " is-pending" : ""}`}
      data-testid="condition-actor-identity"
      data-grid-area="identity"
      data-pending={pending || undefined}
    >
      <TypeIcon
        side={side}
        typeId={typeId}
        size={72}
        className="border border-border-control"
        testId="condition-identity-portrait"
      />
      <div className="identity-body">
        <p className="eyebrow">Species</p>
        <p className="species-name" data-testid="condition-species-name">
          {species ?? "—"}
        </p>
        <div className="badges" data-testid="condition-identity-badges">
          {slots.phase}
          {slots.elements}
        </div>
        {speciesMessage ? <p className="pending-copy">{speciesMessage}</p> : null}
      </div>
    </section>
  );
};

export const CONDITION_SLOT_MAP: Record<string, readonly string[]> = {
  "cond-hero": ["radial", "shield", "meters"],
  "pool-radial": [],
  "pool-meter": [],
  "progression-gauge": [],
  "actor-identity": ["phase", "elements"],
  "stand-row": ["radar", "live"],
  "standing-radar": [],
  "standing-bars": [],
  "status-glyph-strip": []
};

export const conditionFactories: Record<string, PieceFactory> = {
  "cond-hero": condHeroFactory,
  "pool-radial": poolRadialFactory,
  "pool-meter": poolMeterFactory,
  "progression-gauge": progressionGaugeFactory,
  "actor-identity": actorIdentityFactory,
  "stand-row": standRowFactory,
  "standing-radar": standingRadarFactory,
  "standing-bars": standingBarsFactory,
  "status-glyph-strip": statusGlyphStripFactory
};
