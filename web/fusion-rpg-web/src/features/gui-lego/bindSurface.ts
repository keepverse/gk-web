/**
 * bindSurface — walk recipe (+ $bindArray / lifecycleOverlays) → MountPlan.
 */
import { resolveTheme } from "./themeRegistry";
import type {
  MountNode,
  MountPlan,
  PiecePayload,
  RecipeBindArray,
  RecipeDocument,
  RecipePieceRef,
  RecipeSlotFill,
  ThemeRef
} from "./types";

function isBindArray(fill: RecipeSlotFill): fill is RecipeBindArray {
  return typeof fill === "object" && fill != null && "$bindArray" in fill;
}

function isPieceRef(fill: RecipeSlotFill): fill is RecipePieceRef {
  return typeof fill === "object" && fill != null && "piece" in fill && !("$bindArray" in fill);
}

/** Resolve `vm.foo.bar` or relative `rows` against a root object. */
export function getByPath(root: unknown, path: string | undefined): unknown {
  if (!path || path === "vm") return root;
  let cur: unknown = root;
  const parts = path.startsWith("vm.") ? path.slice(3).split(".") : path.split(".");
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function applyTemplate(template: string, item: Record<string, unknown>, index: number): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    if (key === "index") return String(index);
    const v = item[key];
    return v == null ? "" : String(v);
  });
}

function asPayload(
  pieceId: string,
  instanceId: string,
  resolved: unknown
): PiecePayload {
  const base =
    resolved && typeof resolved === "object" && !Array.isArray(resolved)
      ? ({ ...(resolved as Record<string, unknown>) } as PiecePayload)
      : ({ phase: "ready" } as PiecePayload);

  // Validate before overwrite — dead check if piece is replaced first.
  validatePieceMatch(pieceId, base);

  base.piece = pieceId;
  base.instanceId = instanceId;
  if (!base.phase) base.phase = "ready";

  resolveThemeFields(base);

  return base;
}

/** Resolve themeRef / shieldThemeRef (and nested array children) → *Resolved paint. */
function resolveThemeFields(payload: PiecePayload): void {
  if (payload.themeRef) {
    payload.themeResolved = resolveTheme(payload.themeRef as ThemeRef);
  } else if (!payload.themeResolved) {
    payload.themeResolved = resolveTheme(null);
  }

  if (payload.shieldThemeRef) {
    payload.shieldThemeResolved = resolveTheme(payload.shieldThemeRef as ThemeRef);
  }

  for (const [key, value] of Object.entries(payload)) {
    if (key === "themeRef" || key === "themeResolved" || key === "shieldThemeRef" || key === "shieldThemeResolved") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          resolveThemeFields(item as PiecePayload);
        }
      }
    }
  }
}

/** Pack `vfx.select` class id, or null when absent. */
export function vfxClass(themeResolved: { vfx?: { select?: string | null } } | null | undefined): string | null {
  const select = themeResolved?.vfx?.select;
  return select && select.length > 0 ? select : null;
}

/** CSS var map for inline style from themeResolved.css. */
export function themeStyle(
  themeResolved: { css?: Record<string, string> } | null | undefined
): Record<string, string> | undefined {
  const css = themeResolved?.css;
  if (!css || Object.keys(css).length === 0) return undefined;
  return { ...css };
}

function validatePieceMatch(pieceId: string, payload: PiecePayload): void {
  if (payload.piece && payload.piece !== pieceId) {
    throw new Error(
      `gui-lego bindSurface: payload.piece "${payload.piece}" !== recipe piece "${pieceId}" (${payload.instanceId})`
    );
  }
}

function mountRef(
  ref: RecipePieceRef,
  vm: unknown,
  parentPayload: PiecePayload | null,
  opts?: { optionalOmit?: boolean }
): MountNode | null {
  const bindPath = ref.bind;
  let resolved: unknown;
  if (bindPath && !bindPath.startsWith("vm") && parentPayload) {
    resolved = getByPath(parentPayload, bindPath);
  } else {
    resolved = getByPath(vm, bindPath);
  }

  // Q3 — optional slot missing → omit mount (relative OR vm.* path).
  if (opts?.optionalOmit && resolved === undefined) {
    return null;
  }

  const instanceId =
    ref.instanceId ??
    (resolved && typeof resolved === "object" && !Array.isArray(resolved)
      ? String((resolved as PiecePayload).instanceId ?? ref.piece)
      : ref.piece);

  const payload = asPayload(ref.piece, instanceId, Array.isArray(resolved) ? undefined : resolved);
  // When bind points at an array (legacy), stamp count; prefer object binds with count.
  if (Array.isArray(resolved)) {
    payload.phase = "ready";
    payload.count = resolved.length;
  }
  // asPayload already validated

  const slots: MountNode["slots"] = {};
  if (ref.slots) {
    for (const [slotName, fill] of Object.entries(ref.slots)) {
      const mounted = mountSlotFill(fill, vm, payload);
      if (mounted == null) continue;
      if (Array.isArray(mounted)) {
        slots[slotName] = mounted.filter((n): n is MountNode => n != null);
      } else {
        slots[slotName] = mounted;
      }
    }
  }

  return { instanceId, pieceId: ref.piece, payload, slots };
}

function mountSlotFill(
  fill: RecipeSlotFill,
  vm: unknown,
  parentPayload: PiecePayload
): MountNode | MountNode[] | null {
  if (isBindArray(fill)) {
    return mountBindArray(fill, vm, parentPayload);
  }
  if (Array.isArray(fill)) {
    return fill
      .map((r) => mountRef(r, vm, parentPayload, { optionalOmit: true }))
      .filter((n): n is MountNode => n != null);
  }
  if (isPieceRef(fill)) {
    return mountRef(fill, vm, parentPayload, { optionalOmit: true });
  }
  throw new Error("gui-lego bindSurface: invalid slot fill");
}

function mountBindArray(
  spec: RecipeBindArray,
  vm: unknown,
  parentPayload: PiecePayload
): MountNode[] {
  const path = spec.$bindArray;
  let arr: unknown;
  if (path.startsWith("vm.")) {
    arr = getByPath(vm, path);
  } else {
    arr = getByPath(parentPayload, path);
  }
  if (!Array.isArray(arr)) return [];

  return arr.map((item, index) => {
    const rec =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    const instanceId = applyTemplate(spec.instanceIdTemplate, rec, index);
    const payload = asPayload(spec.piece, instanceId, item);
    // validated inside asPayload

    const slots: MountNode["slots"] = {};
    if (spec.slots) {
      for (const [slotName, fill] of Object.entries(spec.slots)) {
        const mounted = mountSlotFill(fill, vm, payload);
        if (mounted == null) continue;
        if (Array.isArray(mounted)) {
          slots[slotName] = mounted.filter((n): n is MountNode => n != null);
        } else {
          slots[slotName] = mounted;
        }
      }
    }
    return { instanceId, pieceId: spec.piece, payload, slots };
  });
}

function overlayForPhase(recipe: RecipeDocument, vm: unknown, phase: string): MountNode | null {
  const overlays = recipe.lifecycleOverlays;
  if (!overlays) return null;
  const key =
    phase === "loading"
      ? "loading"
      : phase === "empty"
        ? "empty"
        : phase === "error"
          ? "error"
          : null;
  if (!key) return null;
  const ref = overlays[key];
  if (!ref) return null;
  const instanceId = ref.instanceId ?? `overlay:${key}`;
  return mountRef({ ...ref, instanceId }, vm, null);
}

export type BindSurfaceOptions = {
  /** When true (default), non-ready phase replaces root with lifecycle overlay. */
  preferOverlay?: boolean;
};

/**
 * Walk recipe → MountPlan. `vm` is the surface fold output (must expose `phase` + `revision`).
 */
export function bindSurface(
  recipe: RecipeDocument,
  vm: unknown,
  options: BindSurfaceOptions = {}
): MountPlan {
  const preferOverlay = options.preferOverlay !== false;
  const rec = (vm && typeof vm === "object" ? vm : {}) as Record<string, unknown>;
  const phase = typeof rec.phase === "string" ? rec.phase : "ready";
  const revision = typeof rec.revision === "number" ? rec.revision : 0;

  const overlay = overlayForPhase(recipe, vm, phase);

  // Full-surface swap only for loading/error — empty keeps chrome (empty lives in dock).
  const swapRoot =
    preferOverlay && overlay && (phase === "loading" || phase === "error");

  if (swapRoot) {
    return { root: null, overlay, revision };
  }

  const root = mountRef(recipe.root, vm, null);
  if (!root) {
    return { root: null, overlay: null, revision };
  }
  // Empty lives in dock (family-list / phase-empty) — do not attach unused surface overlay.
  return { root, overlay: null, revision };
}
