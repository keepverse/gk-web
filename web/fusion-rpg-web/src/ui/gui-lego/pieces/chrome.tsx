import type { PieceFactory } from "@/features/gui-lego/types";
import { SHOW_UNCHANGED_KEY } from "@/features/gui-lego/cook";
import { resolveElementPaint } from "@/features/gui-lego/themes/elementPaint";
import { CatalogIcon } from "@/ui/actor/CatalogIcon";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";

export const identityHdFactory: PieceFactory = ({ payload }) => {
  const style = themeStyle(payload);
  return (
    <div className="identity" style={style}>
      <div className="who">{String(payload.who ?? "")}</div>
      <div className="meta">{String(payload.meta ?? "")}</div>
    </div>
  );
};

export const toolSearchFactory: PieceFactory = ({ payload, bus }) => (
  <input
    className="search"
    type="search"
    value={String(payload.query ?? "")}
    placeholder={String(payload.placeholder ?? "Search channels…")}
    aria-label="Search derived channels"
    data-testid="derived-search"
    onChange={(e) => bus.emit("derived.search.set", { query: e.target.value })}
  />
);

export const toolToggleFactory: PieceFactory = ({ payload, bus }) => {
  const value = Boolean(payload.value);
  const label = String(payload.label ?? "Show unchanged");
  return (
    <button
      type="button"
      role="switch"
      className={`toggle${value ? " is-on" : ""}`}
      title="Persist in localStorage"
      aria-checked={value}
      aria-label={label}
      data-testid="derived-show-unchanged"
      onClick={() => {
        const next = !value;
        bus.emit("derived.showUnchanged.set", { value: next });
        try {
          localStorage.setItem(SHOW_UNCHANGED_KEY, next ? "1" : "0");
        } catch {
          /* ignore quota / private mode */
        }
      }}
    >
      <span className="track" aria-hidden="true">
        <span className="knob" />
      </span>
      {label}
    </button>
  );
};

export const railPrimaryFactory: PieceFactory = ({ payload, slots }) => (
  <nav
    className="cat-bar"
    role="tablist"
    aria-label={String(payload.ariaLabel ?? "Derived surface tabs")}
    data-testid="derived-tab"
    data-primary-tablist="1"
  >
    {slots.chips}
    {slots.tools ? <div className="hd-tools">{slots.tools}</div> : null}
  </nav>
);

export const railVariantFactory: PieceFactory = ({ payload, slots }) => {
  const hidden = Boolean(payload.hidden);
  return (
    <nav
      className="cat-bar variant-bar"
      role="tablist"
      aria-label={String(payload.ariaLabel ?? "Variants")}
      data-testid="derived-variant-rail"
      hidden={hidden || undefined}
      aria-hidden={hidden || undefined}
    >
      {slots.chips}
    </nav>
  );
};

export const chipFactory: PieceFactory = ({ payload, bus }) => {
  const id = String(payload.id ?? "");
  const rail = payload.rail === "variant" ? "variant" : "primary";
  const selected = Boolean(payload.selected);
  const label = String(payload.label ?? id);
  const count = typeof payload.count === "number" ? payload.count : null;
  const elementId =
    payload.elementId != null && String(payload.elementId).length > 0
      ? String(payload.elementId)
      : undefined;
  // DC-6: element chips bind paint via resolveElementPaint (same module as CG-A1).
  const elementPaint = elementId ? resolveElementPaint(elementId) : null;
  const style = {
    ...themeStyle(payload),
    ...(elementPaint?.css ?? {})
  };
  const vfx = vfxClass(payload) ?? (elementPaint?.vfx.select ? elementPaint.vfx.select.replace(/\./g, "-") : undefined);
  const glyphKey =
    (elementPaint?.glyphRef.catalogIcon && elementPaint.glyphRef.catalogIcon.length > 0
      ? elementPaint.glyphRef.catalogIcon
      : null) ??
    (payload.themeResolved?.glyphDefault != null && String(payload.themeResolved.glyphDefault).length > 0
      ? String(payload.themeResolved.glyphDefault)
      : null);
  const glyphColor =
    elementPaint?.paint.accent ??
    (payload.themeResolved?.paint?.accent ? String(payload.themeResolved.paint.accent) : null);

  return (
    <button
      type="button"
      role="tab"
      className={["chip", selected ? "is-on" : null, vfx].filter(Boolean).join(" ")}
      aria-selected={selected}
      data-tab={rail === "primary" ? id : undefined}
      data-v={rail === "variant" ? id : undefined}
      data-el={elementPaint?.dataEl ?? elementId}
      data-testid={rail === "variant" ? `derived-variant-${id}` : `derived-tab-${id}`}
      style={style}
      onClick={() => {
        if (rail === "variant") bus.emit("derived.variant.set", { variantId: id });
        else bus.emit("derived.tab.set", { tabId: id });
      }}
    >
      {glyphKey ? (
        <CatalogIcon
          icon={glyphKey}
          fallbackToken={label.slice(0, 1)}
          color={glyphColor}
          className="chip-glyph"
        />
      ) : null}
      {label}
      {count != null ? (
        <>
          {" "}
          <span className="n">{count}</span>
        </>
      ) : null}
    </button>
  );
};

export const surfaceFootFactory: PieceFactory = ({ payload }) => {
  const hiddenCount = typeof payload.hiddenCount === "number" ? payload.hiddenCount : 0;
  // The note and the deferred line are the **producing surface's** copy, never this piece's. They
  // defaulted to the derived console's own developer wording — its engine-vocabulary join note and
  // its roadmap line — so every other recipe binding `surface-foot` would have rendered that
  // surface's note as if it were its own, engine words included. Absent now means absent, and the
  // caller states its own line (`foldDerivedSurfaceVm.ts:463-464`, which the approved draft carries
  // verbatim at `docs/design/derived-combat-console.html:572-573`).
  //
  // The literal strings are deliberately **not** quoted here: `chrome.foot.test.tsx` scans this file
  // for them, and an explanatory comment that reproduces them would defeat that guard.
  const note = payload.note != null ? String(payload.note) : "";
  const deferred = payload.deferred != null ? String(payload.deferred) : "";
  return (
    <footer className="foot">
      <span>
        Hidden unchanged: <b data-testid="derived-hidden-count">{hiddenCount}</b>
        {note ? ` · ${note}` : null}
      </span>
      {deferred ? <span>{deferred}</span> : null}
    </footer>
  );
};

export const CHROME_SLOT_MAP: Record<string, readonly string[]> = {
  "identity-hd": [],
  "tool-search": [],
  "tool-toggle": [],
  "rail-primary": ["chips", "tools"],
  "rail-variant": ["chips"],
  chip: [],
  "surface-foot": []
};

export const chromeFactories: Record<string, PieceFactory> = {
  "identity-hd": identityHdFactory,
  "tool-search": toolSearchFactory,
  "tool-toggle": toolToggleFactory,
  "rail-primary": railPrimaryFactory,
  "rail-variant": railVariantFactory,
  chip: chipFactory,
  "surface-foot": surfaceFootFactory
};
