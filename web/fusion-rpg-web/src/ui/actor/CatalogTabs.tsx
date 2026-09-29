import { useState } from "react";
import type { ActorView } from "@/contract/types";
import type { ActorSurfaceCatalog, StatusCatalogRow } from "@/contract/actorSurface";
import { InspectSplit } from "./InspectSplit";
import { PendingNote } from "./shared";
import { StatusGlyph } from "./StatusGlyph";

export { ShieldTab } from "./ShieldTab";

export function StatusTab({ surface }: { surface: ActorSurfaceCatalog }) {
  const [selected, setSelected] = useState<StatusCatalogRow | null>(surface.statuses[0] ?? null);

  return (
    <InspectSplit
      testId="status-tab"
      list={
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {surface.statuses.map((status) => (
            <StatusGlyph
              key={status.id}
              status={status}
              selected={selected?.id === status.id}
              onSelect={() => setSelected(status)}
            />
          ))}
        </div>
      }
      inspector={
        selected ? (
          <>
            <h3 className="font-display text-base text-text">{selected.displayName}</h3>
            <p className="text-sm text-muted">{selected.reading}</p>
            <p className="mt-2 text-xs italic text-muted">Mastery lifetime totals are pending.</p>
          </>
        ) : (
          <p className="text-xs italic text-muted">Select a status.</p>
        )
      }
    />
  );
}

export function ElementsTab({ data, surface }: { data: ActorView; surface: ActorSurfaceCatalog }) {
  const knownTyping = data.elementTyping.state === "known" ? data.elementTyping.value : null;
  const concrete = surface.elements.filter((element) => !element.presentationOnly);

  return (
    <div className="mt-4" data-testid="elements-tab">
      <h3 className="font-display text-lg text-text">Element affinities</h3>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {concrete.map((element) => {
          const active =
            knownTyping != null &&
            (knownTyping.primary === element.id || knownTyping.secondary === element.id);
          return (
            <div
              key={element.id}
              data-testid={`element-affinity-${element.id}`}
              data-active={active ? "true" : "false"}
              className={
                active
                  ? "rounded-full border-2 p-4 text-center text-sm text-text"
                  : "rounded-full border border-border-control bg-panel-inset p-4 text-center text-sm text-muted"
              }
              style={
                active
                  ? { borderColor: element.color, background: `${element.color}33` }
                  : { borderColor: undefined }
              }
            >
              {element.displayName}
            </div>
          );
        })}
      </div>
      <PendingNote pending={data.elementTyping} testId="actor-element-pending" />
    </div>
  );
}

export function KitTab({ data, surface }: { data: ActorView; surface: ActorSurfaceCatalog }) {
  return (
    <div className="mt-4" data-testid="kit-tab">
      <h3 className="font-display text-lg text-text">Kit</h3>
      <p className="text-xs text-muted" data-testid="kit-aura-row">
        Aura row — live aura chrome when present.
      </p>
      <p className="text-xs text-muted">Action slots unlock when the action corpus ships.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {surface.kitRoles.map((role) => (
          <div
            key={role.roleId}
            data-testid={`kit-role-${role.roleId}`}
            className="rounded-sm border border-dashed border-border-control p-3 text-sm text-muted"
          >
            {data.side === "plant" ? role.labels.plant : role.labels.humanoid}
          </div>
        ))}
      </div>
      <PendingNote pending={data.equipSlots} testId="kit-equip-pending" />
    </div>
  );
}
