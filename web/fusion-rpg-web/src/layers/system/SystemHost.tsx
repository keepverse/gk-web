import { useSearchParams } from "react-router-dom";
import { registerEmptyStackEscapeFallback } from "@/shell/keymap";
import { useEffect } from "react";
import { SystemLayer } from "./SystemLayer";

/**
 * Mounted once, globally (`AppShell.tsx`), so Settings is reachable from any stage — plate 06 §C:
 * "reached the way every game reaches it — Esc with nothing open." Claims
 * `registerEmptyStackEscapeFallback` (GG-6's designated System-layer owner); once open, it pushes
 * itself onto the real layer stack as band "system" (`PanelShell`'s `band` prop), so a *second*
 * Esc closes it through the normal stack-pop path rather than needing special-case handling.
 */
export function SystemHost() {
  const [searchParams, setSearchParams] = useSearchParams();
  const open = searchParams.get("system") === "1";

  function setOpen(next: boolean) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next) params.set("system", "1");
      else params.delete("system");
      return params;
    });
  }

  useEffect(() => {
    return registerEmptyStackEscapeFallback("system-host", () => setOpen(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SystemLayer open={open} onOpenChange={setOpen} />;
}
