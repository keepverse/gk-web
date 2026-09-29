import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, ...props }: TextInputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-sm border border-border bg-soil px-2 py-1.5 text-md text-text placeholder:text-muted",
        className
      )}
      {...props}
    />
  );
}
