import { useEffect, useState, useSyncExternalStore } from "react";
import { apiBase } from "@/lib/bus/rest";
import { getIconEpoch, subscribeIconEpoch } from "@/lib/bus/icon-epoch";
import { cn } from "@/lib/cn";

/** Stable URL for composed plant/zombie icon (DB); falls back unused until compose recipe exists. */
export function typeIconUrl(side: string, typeId: number): string {
  return `${apiBase()}/api/icons/${side}/${typeId}.png`;
}

export function TypeIcon({
  side,
  typeId,
  size = 40,
  className,
  testId
}: {
  side: string;
  typeId: number;
  size?: number;
  className?: string;
  testId?: string;
}) {
  const revision = useSyncExternalStore(subscribeIconEpoch, getIconEpoch, () => 0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [side, typeId, revision]);

  if (side !== "plant" && side !== "zombie") {
    return (
      <span
        data-testid={testId}
        className={cn("inline-block rounded-sm bg-panel-inset", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (failed) {
    return (
      <span
        data-testid={testId}
        className={cn(
          "inline-flex items-center justify-center rounded-sm border border-border bg-panel-inset text-[10px] text-muted",
          className
        )}
        style={{ width: size, height: size }}
        title={`${side} #${typeId}`}
      >
        #{typeId}
      </span>
    );
  }

  return (
    <img
      data-testid={testId}
      src={`${typeIconUrl(side, typeId)}?r=${revision}`}
      alt=""
      width={size}
      height={size}
      className={cn("rounded-sm object-contain bg-panel-inset", className)}
      onError={() => setFailed(true)}
    />
  );
}
