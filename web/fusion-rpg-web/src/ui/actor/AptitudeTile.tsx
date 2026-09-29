import { cn } from "@/lib/cn";
import { CatalogIcon } from "./CatalogIcon";

export function AptitudeTile({
  id,
  displayName,
  icon,
  value,
  selected,
  onSelect,
  onInc,
  onDec,
  testId
}: {
  id: string;
  displayName: string;
  icon?: string | null;
  value: number;
  selected?: boolean;
  onSelect?: () => void;
  onInc?: () => void;
  onDec?: () => void;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId ?? `aptitude-tile-${id}`}
      data-selected={selected ? "true" : "false"}
      className={cn(
        "rounded-sm border p-3",
        selected ? "border-lawn-hot bg-lawn/15" : "border-border-control bg-panel-inset"
      )}
    >
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <span className="mb-1 flex items-center gap-2">
          <CatalogIcon
            icon={icon}
            fallbackToken={displayName.slice(0, 2)}
            testId={`aptitude-icon-${id}`}
          />
          <span className="block font-ui text-sm text-text">{displayName}</span>
        </span>
        <span className="block font-mono text-lg text-text" data-testid={`aptitude-value-${id}`}>
          {value}
        </span>
      </button>
      <div className="mt-2 flex gap-1">
        <button
          type="button"
          className="rounded-sm border border-border-control px-2 py-0.5 text-sm text-text"
          data-testid={`aptitude-dec-${id}`}
          onClick={onDec}
          aria-label={`Decrease ${displayName}`}
        >
          −
        </button>
        <button
          type="button"
          className="rounded-sm border border-border-control px-2 py-0.5 text-sm text-text"
          data-testid={`aptitude-inc-${id}`}
          onClick={onInc}
          aria-label={`Increase ${displayName}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
