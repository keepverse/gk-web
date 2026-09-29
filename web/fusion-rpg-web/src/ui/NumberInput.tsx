import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  onChange?: (value: number) => void;
};

export function NumberInput({ className, onChange, ...props }: NumberInputProps) {
  return (
    <input
      type="number"
      step="any"
      className={cn(
        "w-full rounded-sm border border-border bg-soil px-2 py-1.5 text-md text-text",
        className
      )}
      onChange={(e) => onChange?.(Number(e.target.value))}
      {...props}
    />
  );
}
