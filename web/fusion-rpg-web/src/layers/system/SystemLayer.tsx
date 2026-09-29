import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiBase, useHealth, useHubStatus } from "@/lib/bus";
import { PanelShell } from "@/shell/PanelShell";
import { captureNextKey, listForbiddenKeys } from "@/shell/keymap";
import { isDevModeEnabled } from "@/dev/devMode";
import { setLocale, type SupportedLocale } from "@/i18n";
import { Badge, Button } from "@/ui";
import {
  ACTION_LABELS,
  conflictFor,
  currentBindings,
  rebind,
  reservedRangeReasonFor,
  resetBindings,
  type BindableActionId
} from "./keybindings";
import {
  DEFAULT_PREFERENCES,
  readPreferences,
  writePreferences,
  type MotionPreference,
  type SystemPreferences
} from "./preferences";
import { UserSettingsPanel } from "@/features/settings/UserSettingsPanel";

type Tab = "preferences" | "display" | "sound" | "controls" | "advanced";

const MOTION_OPTIONS: MotionPreference[] = ["system", "on", "off"];
const MOTION_LABELS: Record<MotionPreference, string> = { system: "System", on: "On", off: "Off" };

function Segmented<T extends string>({
  options,
  labels,
  value,
  onChange,
  testId
}: {
  options: T[];
  labels: Record<T, string>;
  value: T;
  onChange: (next: T) => void;
  testId: string;
}) {
  return (
    <div className="flex gap-1" data-testid={testId}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          aria-current={value === opt}
          data-testid={`${testId}-${opt}`}
          onClick={() => onChange(opt)}
          className={`rounded-sm border px-2 py-1 text-xs ${value === opt ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"}`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onToggle, testId }: { on: boolean; onToggle: () => void; testId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-testid={testId}
      onClick={onToggle}
      className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors ${on ? "bg-lawn-hot" : "bg-panel-inset"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-pill bg-text transition-[left] ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

/**
 * T20 — the System layer (plate 06 §C/§D), band-5, reached the way every game reaches it: Esc on
 * an empty stack (`SystemHost.tsx` claims `registerEmptyStackEscapeFallback`). "Every player-facing
 * toggle the injector already owns" isn't wired here yet (see `preferences.ts`'s honest note) —
 * what's real: the toggles genuinely persist to `localStorage`, Developer mode reuses T12's real
 * `devMode.ts` verbatim, and the Controls tab is a real, live rendering of `keymap.ts`'s own
 * registry (GG-20) with real, working rebinding and conflict detection.
 */
export function SystemLayer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("preferences");
  const [prefs, setPrefs] = useState<SystemPreferences>(DEFAULT_PREFERENCES);
  const [bindings, setBindings] = useState(currentBindings());
  const [devMode, setDevMode] = useState(false);
  const [listeningFor, setListeningFor] = useState<BindableActionId | null>(null);
  const [conflict, setConflict] = useState<{ action: BindableActionId; key: string; with: BindableActionId } | null>(
    null
  );
  const [reservedAttempt, setReservedAttempt] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<SupportedLocale>("en");
  const [connectionDetailsOpen, setConnectionDetailsOpen] = useState(false);
  const health = useHealth();
  const hub = useHubStatus();

  useEffect(() => {
    if (open) {
      setPrefs(readPreferences());
      setBindings(currentBindings());
      setDevMode(isDevModeEnabled());
    }
  }, [open]);

  function setMotionPref(next: MotionPreference) {
    setPref("reduceMotion", next);
  }

  function changeLocale(next: SupportedLocale) {
    setLocaleState(next);
    setLocale(next);
  }

  // Routed through the same `?devmode=1`/`?devmode=0` flow `devMode.ts` already documents as the
  // gate's live-update path (`DevTreeHost.tsx` only re-registers backtick from that effect) —
  // writing straight to localStorage would flip the flag but leave that registration stale.
  function toggleDevMode() {
    const next = !devMode;
    setDevMode(next);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("devmode", next ? "1" : "0");
      return params;
    });
  }

  function setPref<K extends keyof SystemPreferences>(key: K, value: SystemPreferences[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    writePreferences(next);
  }

  function startListening(action: BindableActionId) {
    setConflict(null);
    setReservedAttempt(null);
    setListeningFor(action);
  }

  useEffect(() => {
    if (!listeningFor) return;
    const action = listeningFor;
    return captureNextKey((key) => {
      if (key === "Escape") {
        setListeningFor(null);
        return;
      }
      if (listForbiddenKeys().some((k) => k.toLowerCase() === key.toLowerCase())) {
        setReservedAttempt(`${key.toUpperCase()} is reserved for the game launcher and can't be bound here.`);
        setListeningFor(null);
        return;
      }
      const digitReason = reservedRangeReasonFor(key);
      if (digitReason != null) {
        setReservedAttempt(digitReason);
        setListeningFor(null);
        return;
      }
      const existing = conflictFor(key, action);
      if (existing) {
        setConflict({ action, key, with: existing });
        setListeningFor(null);
        return;
      }
      setBindings(rebind(action, key));
      setListeningFor(null);
    });
  }, [listeningFor]);

  function takeConflict() {
    if (!conflict) return;
    setBindings(rebind(conflict.action, conflict.key));
    setConflict(null);
  }

  return (
    <PanelShell
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
      testId="system-layer"
      band="system"
      footer={
        <>
          {/* fe-essentials: the Title screen this button was waiting on now exists (plate 01 §A). */}
          <Button
            variant="ghost"
            data-testid="system-quit-to-title"
            onClick={() => {
              onOpenChange(false);
              navigate("/");
            }}
          >
            Quit to title
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="system-done">
            Done
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1" data-testid="system-tabs">
        <button
          type="button"
          data-testid="system-tab-preferences"
          aria-current={tab === "preferences"}
          onClick={() => setTab("preferences")}
          className={`rounded-sm border px-2 py-1 text-xs ${tab === "preferences" ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"}`}
        >
          Game
        </button>
        <button
          type="button"
          data-testid="system-tab-display"
          aria-current={tab === "display"}
          onClick={() => setTab("display")}
          className={`rounded-sm border px-2 py-1 text-xs ${tab === "display" ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"}`}
        >
          Display
        </button>
        <button
          type="button"
          data-testid="system-tab-sound"
          disabled
          title="Sound settings aren't available yet."
          className="cursor-not-allowed rounded-sm border border-transparent px-2 py-1 text-xs text-faint opacity-60"
        >
          Sound
        </button>
        <button
          type="button"
          data-testid="system-tab-controls"
          aria-current={tab === "controls"}
          onClick={() => setTab("controls")}
          className={`rounded-sm border px-2 py-1 text-xs ${tab === "controls" ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"}`}
        >
          Controls
        </button>
        <button
          type="button"
          data-testid="system-tab-advanced"
          aria-current={tab === "advanced"}
          onClick={() => setTab("advanced")}
          className={`rounded-sm border px-2 py-1 text-xs ${tab === "advanced" ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"}`}
        >
          Advanced
        </button>
      </div>

      {tab === "preferences" ? (
        <div className="flex flex-col gap-3" data-testid="system-surface-preferences">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">Pause while away</p>
              <p className="text-xs text-muted">
                A live board holds still while a panel is open, so opening one mid-wave cannot cost a run.
              </p>
            </div>
            <Toggle
              testId="pref-pause-while-away"
              on={prefs.pauseWhileAway}
              onToggle={() => setPref("pauseWhileAway", !prefs.pauseWhileAway)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">Damage numbers</p>
              <p className="text-xs text-muted">Show floating numbers on the lawn.</p>
            </div>
            <Toggle
              testId="pref-damage-numbers"
              on={prefs.damageNumbers}
              onToggle={() => setPref("damageNumbers", !prefs.damageNumbers)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">Skip reward moments</p>
              <p className="text-xs text-muted">Level-ups and drops report as notifications instead.</p>
            </div>
            <Toggle
              testId="pref-skip-reward-moments"
              on={prefs.skipRewardMoments}
              onToggle={() => setPref("skipRewardMoments", !prefs.skipRewardMoments)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">Developer mode</p>
              <p className="text-xs text-muted">
                Adds the diagnostics tree on <span className="font-mono">`</span>. Off by default; nothing else changes.
              </p>
            </div>
            <Toggle testId="pref-developer-mode" on={devMode} onToggle={toggleDevMode} />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <div>
              <p className="text-sm font-semibold text-text">Connection</p>
              <p className="text-xs text-muted" data-testid="system-connection-summary">
                {health.data?.ok ? "Sanctum reachable" : "Sanctum unreachable"} · {hub === "on" ? "live" : "poll fallback"} ·{" "}
                {health.data?.injectorConnected ? "game connected" : "game not connected"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={health.data?.ok && hub === "on" ? "ok" : "warn"} data-testid="system-connection-tag">
                {health.data?.ok && hub === "on" ? "healthy" : "degraded"}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConnectionDetailsOpen((v) => !v)}
                data-testid="system-connection-details-toggle"
              >
                Details
              </Button>
            </div>
          </div>
          {connectionDetailsOpen ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-sm border border-border p-3 text-xs" data-testid="system-connection-details">
              <dt className="text-muted">API base</dt>
              <dd className="font-mono text-text">{apiBase() || window.location.origin}</dd>
              <dt className="text-muted">SignalR</dt>
              <dd className="text-text">{hub}</dd>
              <dt className="text-muted">Source</dt>
              <dd className="text-text">{health.data?.source ?? "unknown"}</dd>
              <dt className="text-muted">Last heartbeat</dt>
              <dd className="text-text">{health.data?.lastHeartbeatUtc ?? "never"}</dd>
            </dl>
          ) : null}
        </div>
      ) : null}

      {tab === "display" ? (
        <div className="flex flex-col gap-3" data-testid="system-surface-display">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">Reduce motion</p>
              <p className="text-xs text-muted">Follows your system setting by default. Nothing loses meaning when it is on.</p>
            </div>
            <Segmented
              testId="pref-reduce-motion"
              options={MOTION_OPTIONS}
              labels={MOTION_LABELS}
              value={prefs.reduceMotion}
              onChange={setMotionPref}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">Language</p>
              <p className="text-xs text-muted">
                {import.meta.env.DEV
                  ? "English is the only shipped locale; Pseudo wraps every string for layout QA."
                  : "English is the only language available right now."}
              </p>
            </div>
            <Segmented
              testId="pref-locale"
              options={import.meta.env.DEV ? (["en", "pseudo"] as SupportedLocale[]) : (["en"] as SupportedLocale[])}
              labels={{ en: "English", pseudo: "Pseudo (QA)" } as Record<SupportedLocale, string>}
              value={locale}
              onChange={changeLocale}
            />
          </div>
          <UserSettingsPanel />
          <p className="text-xs text-muted" data-testid="system-display-honest-gap">
            Interface scale, text size and colour-blind assist aren't wired to anything real yet, so
            they aren't shown here rather than pretending to work.
          </p>
        </div>
      ) : null}

      {tab === "advanced" ? (
        <div className="flex flex-col gap-3" data-testid="system-surface-advanced">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">API base</p>
              <p className="text-xs text-muted">Where this browser sends every request.</p>
            </div>
            <span className="rounded-sm border border-border px-2 py-1 font-mono text-xs text-text" data-testid="system-advanced-api-base">
              {apiBase() || window.location.origin}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">Reset preferences</p>
              <p className="text-xs text-muted">Restores every Game/Display toggle above to its default. Keybindings are separate (Controls tab).</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPrefs(DEFAULT_PREFERENCES);
                writePreferences(DEFAULT_PREFERENCES);
                changeLocale("en");
              }}
              data-testid="system-reset-preferences"
            >
              Reset
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "controls" ? (
        <div className="flex flex-col gap-2" data-testid="system-surface-controls">
          {(Object.keys(ACTION_LABELS) as BindableActionId[]).map((action) => (
            <div key={action} className="flex items-center justify-between gap-3" data-testid={`keybind-row-${action}`}>
              <div>
                <p className="text-sm font-semibold text-text">{ACTION_LABELS[action]}</p>
              </div>
              {listeningFor === action ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-sm border border-sun px-2 py-1 text-xs text-sun" data-testid={`keybind-listening-${action}`}>
                    Press a key…
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setListeningFor(null)} data-testid={`keybind-cancel-${action}`}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="rounded-sm border border-border px-2 py-1 text-xs uppercase text-text" data-testid={`keybind-key-${action}`}>
                    {bindings[action]}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => startListening(action)} data-testid={`keybind-change-${action}`}>
                    Change
                  </Button>
                </div>
              )}
            </div>
          ))}

          {conflict ? (
            <div className="rounded-sm border border-bad p-3" data-testid="keybind-conflict">
              <p className="text-sm text-bad" data-testid="keybind-conflict-reason">
                {conflict.key.toUpperCase()} is already {ACTION_LABELS[conflict.with]}. Taking it will give{" "}
                {ACTION_LABELS[conflict.with]} your current key ({bindings[conflict.action].toUpperCase()}) instead.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConflict(null)} data-testid="keybind-conflict-keep">
                  Keep {bindings[conflict.action].toUpperCase()}
                </Button>
                <Button size="sm" variant="danger" onClick={takeConflict} data-testid="keybind-conflict-take">
                  Take it
                </Button>
              </div>
            </div>
          ) : null}

          {reservedAttempt ? (
            <div className="rounded-sm border border-bad p-3" data-testid="keybind-reserved-refusal">
              <p className="text-sm text-bad">{reservedAttempt}</p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => setReservedAttempt(null)}
                data-testid="keybind-reserved-dismiss"
              >
                OK
              </Button>
            </div>
          ) : null}

          {listForbiddenKeys().map((key) => (
            <div key={key} className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
              <div>
                <p className="text-sm font-semibold text-text">Show or hide the control room</p>
                <p className="text-xs text-muted">Owned by the game launcher</p>
              </div>
              <span
                className="rounded-sm border border-border px-2 py-1 text-xs uppercase text-muted"
                data-testid={`keybind-key-reserved-${key.toLowerCase()}`}
              >
                {key} · reserved
              </span>
            </div>
          ))}

          <Button
            size="sm"
            variant="ghost"
            className="mt-2 self-start"
            onClick={() => setBindings(resetBindings())}
            data-testid="keybind-reset"
          >
            Reset to defaults
          </Button>
        </div>
      ) : null}
    </PanelShell>
  );
}
