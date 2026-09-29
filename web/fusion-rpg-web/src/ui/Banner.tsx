import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const bannerVariants = cva("relative px-4 py-2 text-sm font-semibold", {
  variants: {
    tone: {
      error: "bg-bad-solid text-text",
      warn: "bg-warn/30 text-text border-b border-warn",
      info: "bg-lawn/40 text-text border-b border-lawn-hot"
    }
  },
  defaultVariants: { tone: "error" }
});

export type BannerProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof bannerVariants>;

export function Banner({ className, tone, ...props }: BannerProps) {
  return <div role="alert" className={cn(bannerVariants({ tone }), className)} {...props} />;
}
