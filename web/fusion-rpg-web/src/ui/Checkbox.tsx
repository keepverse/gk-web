import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function Checkbox({ className, label, id, ...props }: CheckboxProps) {
  const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <label htmlFor={inputId} className={cn("mt-2 flex items-center gap-2 text-sm text-muted", className)}>
      <input id={inputId} type="checkbox" className="accent-lawn" {...props} />
      <span>{label}</span>
    </label>
  );
}
