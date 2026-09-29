import { cn } from "@/lib/cn";
import { displayInitial } from "./shared";
import type { Pending } from "@/contract/pending";
import { isKnown } from "@/contract/pending";
import type { ActorSheetDto } from "@/contract/actorSurface";
import { resolveTheme } from "@/features/gui-lego/themeRegistry";
import type { PiecePayload, SurfaceBusLike } from "@/features/gui-lego/types";
import { TypeIcon } from "@/ui";
import { roleBadgeFactory } from "@/ui/gui-lego/pieces/badges";

export type ActorSummarizeProps = {
  displayName: Pending<string>;
  instanceId: string;
  level: number;
  roleLabel: string;
  side: "plant" | "zombie";
  collapsed: boolean;
  sheet?: ActorSheetDto | null;
  className?: string;
};

const NOOP_BUS: SurfaceBusLike = {
  emit: () => undefined,
  on: () => () => undefined
};

/**
 * Left-rail identity — name / Lv + role-badge (+ portrait). Species chips live on Condition.
 */
export function ActorSummarize({
  displayName,
  instanceId,
  level,
  roleLabel,
  side,
  collapsed,
  sheet,
  className
}: ActorSummarizeProps) {
  const name = sheet?.displayName || (isKnown(displayName) ? displayName.value : `#${instanceId.slice(0, 6)}`);
  const effectiveLevel = sheet?.level ?? level;
  const effectiveRole = (sheet?.roleLabel ?? roleLabel).trim();
  const tipParts = [name, `Lv ${effectiveLevel}`];
  if (effectiveRole) tipParts.push(effectiveRole);
  const tip = tipParts.join(" · ");
  const initial = displayInitial(displayName, side);

  const themeRef = { kind: "side" as const, id: side };
  const roleBadge =
    effectiveRole.length > 0
      ? roleBadgeFactory({
          payload: {
            piece: "role-badge",
            instanceId: `rail:role:${instanceId}`,
            phase: "ready",
            label: effectiveRole,
            themeRef,
            themeResolved: resolveTheme(themeRef)
          } as PiecePayload,
          slots: {},
          bus: NOOP_BUS
        })
      : null;

  if (collapsed) {
    return (
      <div
        className={cn("flex justify-center", className)}
        data-testid="actor-summarize"
        data-collapsed="true"
        title={tip}
      >
        {sheet ? (
          <TypeIcon
            side={side}
            typeId={sheet.typeId}
            size={32}
            className="rounded-sm border border-border-control"
            testId="actor-summarize-portrait"
          />
        ) : (
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border-control bg-panel-inset font-display text-sm text-text"
            data-testid="actor-summarize-glyph"
            aria-label={tip}
          >
            {initial}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)} data-testid="actor-summarize" data-collapsed="false">
      <div className="flex items-start gap-3">
        {sheet ? (
          <TypeIcon side={side} typeId={sheet.typeId} size={48} className="border border-border-control" testId="actor-summarize-portrait" />
        ) : (
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-sm border border-border-control bg-panel-inset font-display text-lg text-text"
            data-testid="actor-summarize-glyph"
          >
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight text-text" data-testid="actor-summarize-name">
            {name}
          </p>
          <div
            className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted"
            data-testid="actor-summarize-meta"
          >
            <span data-testid="actor-summarize-level">Lv {effectiveLevel}</span>
            {roleBadge}
          </div>
        </div>
      </div>
    </div>
  );
}
