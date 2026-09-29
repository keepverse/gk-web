import { Button } from "./Button";
import { HelpText } from "./HelpText";
import { cn } from "@/lib/cn";

export function Pager({
  label,
  canPrev,
  canNext,
  onPrev,
  onNext,
  className,
  testId = "pager"
}: {
  label: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className={cn("mt-3 flex flex-wrap items-center gap-2", className)}>
      <Button
        data-testid={`${testId}-prev`}
        size="sm"
        variant="ghost"
        disabled={!canPrev}
        title={canPrev ? undefined : "Already at the first page"}
        onClick={onPrev}
      >
        Prev
      </Button>
      <HelpText>{label}</HelpText>
      <Button
        data-testid={`${testId}-next`}
        size="sm"
        variant="ghost"
        disabled={!canNext}
        title={canNext ? undefined : "No more pages"}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
}
