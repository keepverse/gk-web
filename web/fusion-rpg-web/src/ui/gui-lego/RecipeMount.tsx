import { Fragment, type CSSProperties, type ReactNode } from "react";
import { getPiece } from "@/features/gui-lego/pieceRegistry";
import type { MountNode, MountPlan, PiecePayload, SurfaceBusLike } from "@/features/gui-lego/types";

export function themeStyle(payload: PiecePayload): CSSProperties | undefined {
  const css = payload.themeResolved?.css;
  if (!css) return undefined;
  return css as CSSProperties;
}

export function vfxClass(payload: PiecePayload): string | undefined {
  const select = payload.themeResolved?.vfx?.select;
  if (!select) return undefined;
  return select.replace(/\./g, "-");
}

function renderNode(node: MountNode, bus: SurfaceBusLike): ReactNode {
  const reg = getPiece(node.pieceId);
  const slotNodes: Record<string, ReactNode> = {};

  for (const [name, child] of Object.entries(node.slots)) {
    if (Array.isArray(child)) {
      slotNodes[name] = (
        <>
          {child.map((c) => (
            <Fragment key={c.instanceId}>{renderNode(c, bus)}</Fragment>
          ))}
        </>
      );
    } else {
      slotNodes[name] = renderNode(child, bus);
    }
  }

  if (reg?.factory) {
    return (
      <Fragment key={node.instanceId}>
        {reg.factory({ payload: node.payload, slots: slotNodes, bus })}
      </Fragment>
    );
  }

  const style = themeStyle(node.payload);
  const vfx = vfxClass(node.payload);
  return (
    <div
      key={node.instanceId}
      data-piece={node.pieceId}
      data-instance={node.instanceId}
      data-phase={node.payload.phase}
      className={vfx}
      style={style}
    >
      {Object.values(slotNodes)}
    </div>
  );
}

export type RecipeMountProps = {
  plan: MountPlan;
  bus: SurfaceBusLike;
};

/**
 * Renders MountPlan. Overlay wins when root is null (lifecycle).
 * Factories must emit landmark roots as direct children of parents that use `>` CSS.
 */
export function RecipeMount({ plan, bus }: RecipeMountProps) {
  const node = plan.root ?? plan.overlay;
  if (!node) return null;
  return <>{renderNode(node, bus)}</>;
}
