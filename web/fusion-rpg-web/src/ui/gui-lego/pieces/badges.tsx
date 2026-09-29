import type { CSSProperties } from "react";
import type { PieceFactory, PiecePayload } from "@/features/gui-lego/types";
import { resolveElementPaint } from "@/features/gui-lego/themes/elementPaint";
import { isShieldSummaryMountable } from "@/features/gui-lego/shieldMount";
import { CatalogIcon } from "@/ui/actor/CatalogIcon";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import "./badgePieces.css";

export { isShieldSummaryMountable };

function accentStyle(payload: PiecePayload, accentHex?: string): CSSProperties | undefined {
  const fromTheme = themeStyle(payload);
  if (!accentHex && !fromTheme) return undefined;
  return {
    ...(fromTheme ?? {}),
    ...(accentHex
      ? {
          ["--piece-accent" as string]: accentHex,
          ["--piece-rail-edge" as string]: accentHex
        }
      : {})
  } as CSSProperties;
}

export const elementBadgeFactory: PieceFactory = ({ payload }) => {
  const elementId = String(payload.elementId ?? "").trim();
  if (!elementId) return null;

  const paint = resolveElementPaint(elementId);
  const label = String(payload.label ?? paint.label);
  const selectable = Boolean(payload.selectable);
  const vfx = vfxClass(payload);
  const accent = payload.themeResolved?.paint?.accent ?? paint.paint.accent;
  const style = accentStyle(payload, accent);
  const glyphKey =
    payload.themeResolved?.glyphDefault != null && String(payload.themeResolved.glyphDefault).length > 0
      ? String(payload.themeResolved.glyphDefault)
      : paint.glyphRef.catalogIcon ?? null;

  const className = ["element-badge", vfx].filter(Boolean).join(" ");
  const body = (
    <>
      {glyphKey ? (
        <CatalogIcon
          icon={glyphKey}
          fallbackToken={label.slice(0, 1)}
          color={accent}
          className="element-badge-glyph"
        />
      ) : null}
      {label}
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        className={className}
        data-el={paint.dataEl}
        data-testid={`element-badge-${elementId}`}
        style={style}
      >
        {body}
      </button>
    );
  }

  return (
    <span
      className={className}
      data-el={paint.dataEl}
      data-testid={`element-badge-${elementId}`}
      style={style}
    >
      {body}
    </span>
  );
};

export const phaseBadgeFactory: PieceFactory = ({ payload }) => {
  const label = String(payload.label ?? "").trim();
  if (!label) return null;

  const vfx = vfxClass(payload);
  const accent = payload.themeResolved?.paint?.accent;
  const style = accentStyle(payload, accent);

  return (
    <span
      className={["phase-badge", vfx].filter(Boolean).join(" ")}
      data-testid="phase-badge"
      style={style}
    >
      {label}
    </span>
  );
};

export const roleBadgeFactory: PieceFactory = ({ payload }) => {
  const label = String(payload.label ?? "").trim();
  if (!label) return null;

  const vfx = vfxClass(payload);
  const accent = payload.themeResolved?.paint?.accent;
  const style = accentStyle(payload, accent);
  const roleId =
    payload.roleId != null && String(payload.roleId).length > 0
      ? String(payload.roleId)
      : label.toLowerCase().replace(/\s+/g, "-");

  return (
    <span
      className={["role-badge", vfx].filter(Boolean).join(" ")}
      data-testid="role-badge"
      data-role={roleId}
      style={style}
    >
      {label}
    </span>
  );
};

export const shieldStatusFactory: PieceFactory = ({ payload }) => {
  const current = typeof payload.current === "number" ? payload.current : Number(payload.current ?? 0);
  if (!Number.isFinite(current) || current <= 0) return null;

  const max = typeof payload.max === "number" ? payload.max : Number(payload.max ?? 0);
  const elementId =
    payload.elementId != null && String(payload.elementId).length > 0
      ? String(payload.elementId)
      : null;
  const paint = elementId ? resolveElementPaint(elementId) : null;
  const accent = payload.themeResolved?.paint?.accent ?? paint?.paint.accent;
  const style = accentStyle(payload, accent);
  const currentText = String(payload.currentText ?? current.toLocaleString());
  const maxText = String(payload.maxText ?? (Number.isFinite(max) ? max.toLocaleString() : "—"));
  const stacks = typeof payload.stacks === "number" ? payload.stacks : null;
  const eyebrow = elementId ? `Shield · ${paint?.label ?? elementId}` : "Shield";

  return (
    <div className="shield-status" data-testid="shield-status" data-el={paint?.dataEl} style={style}>
      <p className="eyebrow">{eyebrow}</p>
      <p className="hp">
        {currentText} / {maxText}
      </p>
      {stacks != null && stacks > 0 ? <p className="stacks">{stacks} stacks</p> : null}
    </div>
  );
};

export const BADGE_SLOT_MAP: Record<string, readonly string[]> = {
  "element-badge": [],
  "phase-badge": [],
  "role-badge": [],
  "shield-status": []
};

export const badgeFactories: Record<string, PieceFactory> = {
  "element-badge": elementBadgeFactory,
  "phase-badge": phaseBadgeFactory,
  "role-badge": roleBadgeFactory,
  "shield-status": shieldStatusFactory
};
