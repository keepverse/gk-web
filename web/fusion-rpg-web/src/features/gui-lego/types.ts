/**
 * GUI Lego shared types (payload-types + MountPlan).
 * Design SSOT: docs/architecture/gui-lego/payload-types.md
 */
import type { ReactNode } from "react";

export type Phase = "ready" | "loading" | "empty" | "error" | "pending";

export type DerivedRenderState =
  | "active"
  | "default"
  | "capped"
  | "stub"
  | "no-producer"
  | "unregistered";

export type ThemeKind =
  | "element"
  | "status-category"
  | "resource"
  | "action-category"
  | "rarity"
  | "side"
  | "cook-tab"
  | "bucket"
  | "posture"
  /**
   * A story-scene cast member's identity paint (`actor.penny`, `actor.dave`) — story-scene S2,
   * 2026-09-15. Deliberately its own kind rather than a reuse of `side`: `side` is a **faction**
   * axis (`side-plant`, `side-zombie`), and Dave is a person while Penny is Crazy Dave's time
   * machine, so neither belongs on it. Overloading `side` would make "a person" and "a faction"
   * one vocabulary.
   */
  | "actor"
  /**
   * A story scene's mood paint (`scene.rift-portal`, `scene.quarantine`) — story-scene S2,
   * 2026-09-15. Not `neutral` (which is the *absence* of a pack, so every actor would look
   * identical), and not merged into `actor` (which would make a person's paint depend on which
   * scene he happens to stand in).
   */
  | "scene"
  /**
   * Wonder scope and rarity paint (`wonder-scope.Sector`, `wonder-rarity.Unique`) —
   * empire-wonder-surfaces `wonder-display` §Design 2. Pack ids carry exact wire case so the fold
   * maps wire to paint with no case-folding.
   */
  | "wonder-scope"
  | "wonder-rarity"
  | "neutral";

export type ThemeRef = {
  kind: ThemeKind;
  id: string;
};

export type ThemeResolved = {
  themeId: string;
  css: Record<string, string>;
  paint: {
    accent: string;
    accentMuted: string;
    onAccent: string;
  };
  vfx: { select: string | null; idle: string | null };
  /** Lucide / CatalogIcon key when the pack authors a default glyph. */
  glyphDefault?: string | null;
};

export type ThemePack = {
  themeId: string;
  kind: string;
  id: string;
  css: Record<string, string>;
  paint: ThemeResolved["paint"];
  vfx: ThemeResolved["vfx"];
  glyphDefault?: string | null;
};

export type GlyphRef = {
  catalogIcon?: string;
  hudToken?: string;
  fallbackText?: string;
};

export type MagnitudeDisplay = {
  valueRaw: number | string;
  valueText: string;
  unitLabel?: string | null;
  formatterId: string;
};

export type PieceEnvelope = {
  piece: string;
  instanceId: string;
  phase: Phase;
  themeRef?: ThemeRef;
  themeResolved?: ThemeResolved;
  shieldThemeRef?: ThemeRef;
  shieldThemeResolved?: ThemeResolved;
};

export type PiecePayload = PieceEnvelope & Record<string, unknown>;

/** Locked MountPlan node — bindSurface output. */
export type MountNode = {
  instanceId: string;
  pieceId: string;
  payload: PiecePayload;
  slots: Record<string, MountNode | MountNode[]>;
};

export type MountPlan = {
  root: MountNode | null;
  overlay: MountNode | null;
  revision: number;
};

/** Recipe piece ref (design JSON). */
export type RecipePieceRef = {
  piece: string;
  instanceId?: string;
  bind?: string;
  slots?: Record<string, RecipeSlotFill>;
};

export type RecipeBindArray = {
  $bindArray: string;
  piece: string;
  instanceIdTemplate: string;
  slots?: Record<string, RecipeSlotFill>;
};

export type RecipeSlotFill =
  | RecipePieceRef
  | RecipePieceRef[]
  | RecipeBindArray;

export type RecipeDocument = {
  surfaceId: string;
  host?: string;
  version?: number;
  notes?: string;
  root: RecipePieceRef;
  lifecycleOverlays?: Partial<
    Record<"loading" | "empty" | "error" | "pendingField", RecipePieceRef>
  >;
};

export type PieceFactory = (args: {
  payload: PiecePayload;
  slots: Record<string, ReactNode>;
  bus: SurfaceBusLike;
}) => ReactNode;

export type PieceRegistration = {
  pieceId: string;
  slots: readonly string[];
  factory?: PieceFactory;
};

/** Minimal bus surface for pieces (generic createSurfaceBus). */
export type SurfaceBusLike = {
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, handler: (payload: unknown) => void) => () => void;
};
