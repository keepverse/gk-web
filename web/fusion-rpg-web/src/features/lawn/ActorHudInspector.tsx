import type { ActorHudSnapshot } from "./lawnViewModel";
import { actorHudElementArtUrl } from "./actorHudElementArt";
import {
  TIER_BORDER,
  elementColorHex,
  resolveStatusHudToken,
  tierBadgeLetter
} from "@/game/systems/actorHudDisplayTokens";

function magnitudeClass(band: string): string {
  if (band === "high") return "ring-1 ring-bad-solid/60";
  if (band === "mid") return "ring-1 ring-lawn-hot/50";
  return "";
}

type Props = { hud: ActorHudSnapshot };

/** Inspector expansion for Occupant.hud — same fields as fold SSOT (actor-hud-fold spec). */
export function ActorHudInspector({ hud }: Props) {
  const { identity, resources, statuses, overflow, elements } = hud;
  const shield = resources?.shield;

  return (
    <div className="space-y-2 rounded-md border border-border bg-panel-inset p-2" data-testid="actor-hud-inspector">
      <div className="flex items-center gap-2" data-testid="actor-hud-tier">
        <span
          className={`inline-grid h-[18px] w-[18px] place-items-center rounded-sm border-2 bg-black/35 font-mono text-[9px] font-extrabold ${TIER_BORDER[identity.tier] ?? TIER_BORDER.normal}`}
          data-tier={identity.tier}
          title={`Tier: ${identity.tier}`}
        >
          {tierBadgeLetter(identity.tier)}
        </span>
        {identity.levelBand != null ? (
          <span
            className="min-w-[16px] rounded-full border border-border-control bg-panel-raised px-1 font-mono text-[8px] font-extrabold"
            data-testid="actor-hud-level"
          >
            {identity.levelBand}
          </span>
        ) : null}
        <span
          className="inline-grid h-[14px] w-[14px] place-items-center rounded-full border border-border-control bg-panel text-[8px]"
          data-role={identity.role}
          title={`Role: ${identity.role}`}
        >
          {identity.role === "specimen" ? "S" : "V"}
        </span>
        {elements ? [elements.primary, elements.secondary].filter((id): id is string => Boolean(id)).map((id) => {
          const url = actorHudElementArtUrl(id);
          return url ? <img key={id} src={url} alt={id} title={id} className="h-6 w-6 object-contain" data-testid={`actor-hud-element-${id}`} /> : null;
        }) : null}
        {identity.flags.length ? (
          <span className="font-mono text-[10px] text-muted">{identity.flags.join(", ")}</span>
        ) : null}
      </div>

      {shield ? (
        <div className="flex items-center gap-1" data-testid="actor-hud-shield">
          <span className="text-[8px] font-bold uppercase tracking-wide text-muted">Shield</span>
          <div className="flex h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-panel-inset">
            {shield.stacks.map((seg, i) => {
              const ratio = seg.max > 0 ? seg.hp / seg.max : 0;
              const color = elementColorHex(seg.element);
              return (
                <span
                  key={`${seg.element}-${i}`}
                  className="h-full"
                  style={{ width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: color }}
                  title={`${seg.element} ${seg.hp}/${seg.max}`}
                />
              );
            })}
          </div>
          <span className="font-mono text-[10px] text-muted">
            {shield.hp}/{shield.max}
          </span>
        </div>
      ) : null}

      {statuses.length || overflow.statusCount > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {statuses.map((s) => {
            const token = resolveStatusHudToken(s.id);
            return (
              <span
                key={s.id}
                className={`inline-flex min-w-[18px] items-center justify-center rounded-sm border border-border-control bg-panel-raised px-1 font-mono text-[9px] font-bold ${magnitudeClass(s.magnitudeBand)} ${s.cc ? "border-lawn-hot" : ""}`}
                data-testid={`actor-hud-status-${s.id}`}
                style={{ color: token.color }}
                title={`${token.displayName} (${s.magnitudeBand})${s.cc ? " CC" : ""}`}
              >
                {token.hudToken}
              </span>
            );
          })}
          {overflow.statusCount > 0 ? (
            <span
              className="inline-flex min-w-[14px] items-center justify-center rounded-full border border-border-control bg-panel-raised px-1 font-mono text-[8px] font-bold"
              data-testid="actor-hud-overflow"
            >
              +{overflow.statusCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
