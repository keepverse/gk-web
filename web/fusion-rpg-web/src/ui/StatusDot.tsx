import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const dotVariants = cva("inline-block size-2 rounded-pill", {
  variants: {
    status: {
      on: "bg-ok",
      off: "bg-muted",
      err: "bg-bad"
    }
  },
  defaultVariants: { status: "off" }
});

export function StatusDot({
  status,
  label,
  className,
  ...props
}: {
  status: NonNullable<VariantProps<typeof dotVariants>["status"]>;
  label: string;
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm text-muted", className)}
      data-status={status}
      {...props}
    >
      <span className={dotVariants({ status })} aria-hidden />
      {label}
    </span>
  );
}
