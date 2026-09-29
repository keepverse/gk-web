import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";
import { clearLogEvents } from "@/lib/bus/log-store";
// Activates the (module-global) Lingui i18n singleton once for every test
// run, mirroring the real boot order (main.tsx -> providers.tsx -> "@/i18n").
// The `t` macro compiles to a call against this same singleton regardless of
// whether a test wraps its render in <I18nProvider> — without this import
// somewhere in the module graph, any component using `t`/`Trans` throws
// "Attempted to call a translation function without setting a locale."
import "@/i18n";

// Recharts ResponsiveContainer needs layout APIs in jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get() {
    return 480;
  }
});
Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get() {
    return 240;
  }
});
Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value() {
    return {
      width: 480,
      height: 240,
      top: 0,
      left: 0,
      bottom: 240,
      right: 480,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      }
    };
  }
});

afterEach(() => {
  cleanup();
  clearLogEvents();
});

/**
 * Async budget for `waitFor` / `findBy*`.
 *
 * The default is 1000ms — short for anything waiting on a **lazy chunk**. Several pieces and stages
 * mount `React.lazy(() => import(...))` (the standing radar in `condition.tsx:11`, the Sanctum
 * layers), so the thing being awaited is a dynamic import plus the chunk's own module cost, not a
 * component that misbehaved. In a fully parallel full-suite run that race is lost often enough to
 * make the suite's own counts unstable: three consecutive runs of one unchanged tree produced 5,
 * then 2, then 1 failing tests (F10), each a `waitFor` timeout at a different lazy mount.
 *
 * This changes only how long an *unmet* condition is waited for. Every assertion still has to pass,
 * so a real regression still fails the suite — one second later. Sites that wait for a named lazy
 * chunk keep their own explicit budget and say why.
 */
configure({ asyncUtilTimeout: 5000 });
