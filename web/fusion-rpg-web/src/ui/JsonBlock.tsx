import { cn } from "@/lib/cn";

export function JsonBlock({
  value,
  className
}: {
  value: unknown;
  className?: string;
}) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre
      className={cn(
        "max-h-[420px] overflow-auto rounded-sm bg-panel-inset p-2.5 font-mono text-xs whitespace-pre-wrap shadow-inset",
        className
      )}
    >
      {text}
    </pre>
  );
}
