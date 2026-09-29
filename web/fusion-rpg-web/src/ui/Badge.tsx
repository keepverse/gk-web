import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        ok: "bg-ok/20 text-ok",
        bad: "bg-bad/20 text-bad",
        warn: "bg-warn/20 text-warn",
        plant: "bg-lawn/30 text-lawn-hot",
        zombie: "bg-zombie/40 text-almanac",
        neutral: "bg-border/40 text-muted"
      }
    },
    defaultVariants: { tone: "neutral" }
  }
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
