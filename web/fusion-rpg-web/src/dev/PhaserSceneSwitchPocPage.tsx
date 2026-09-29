import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPocController,
  POC_MODES,
  summarizeTimings,
  trackAPasses,
  trackBPasses,
  TRACK_A_P95_MS,
  TRACK_B_P95_MS,
  type PocController,
  type PocMode,
  type PocTrack,
  type TimingSummary
} from "@/game/poc/scene-switch";

let pocGeneration = 1;

/**
 * Developer-tree surface: Phaser 4.2 scene-switch POC (Track A vs Track B) under React chrome.
 * Not a player stage — reached via `?dev=phaser-scene-poc`.
 */
export function PhaserSceneSwitchPocPage() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<PocController | null>(null);
  const [track, setTrack] = useState<PocTrack>("A");
  const [mode, setMode] = useState<PocMode>("world");
  const [busy, setBusy] = useState(false);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [samples, setSamples] = useState<number[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [gameIdBeforePanel, setGameIdBeforePanel] = useState<string | null>(null);
  const [gameIdAfterPanel, setGameIdAfterPanel] = useState<string | null>(null);
  const [identityStable, setIdentityStable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runLog, setRunLog] = useState<string>("");

  const remount = useCallback(async (nextTrack: PocTrack, nextMode: PocMode) => {
    const parent = parentRef.current;
    if (!parent) return;
    setBusy(true);
    setError(null);
    try {
      await controllerRef.current?.destroy();
      controllerRef.current = null;
      parent.replaceChildren();
      const generation = pocGeneration++;
      controllerRef.current = createPocController({
        parent,
        track: nextTrack,
        initialMode: nextMode,
        generation
      });
      setMode(nextMode);
      setSamples([]);
      setLastMs(null);
      setIdentityStable(null);
      setGameIdBeforePanel(null);
      setGameIdAfterPanel(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void remount(track, "world");
    return () => {
      void controllerRef.current?.destroy();
      controllerRef.current = null;
    };
    // Mount once; track changes go through onTrackChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary: TimingSummary = useMemo(() => summarizeTimings(samples), [samples]);

  const onTrackChange = async (next: PocTrack) => {
    if (next === track || busy) return;
    setTrack(next);
    await remount(next, mode);
  };

  const switchMode = async (next: PocMode) => {
    const c = controllerRef.current;
    if (!c || busy) return;
    if (next === c.getMode()) return;
    setBusy(true);
    setError(null);
    try {
      const ms = await c.switchTo(next);
      setMode(c.getMode());
      setLastMs(ms);
      setSamples((prev) => [...prev, ms]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runTwenty = async () => {
    const c = controllerRef.current;
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    const collected: number[] = [];
    try {
      let cursor = c.getMode();
      for (let i = 0; i < 20; i++) {
        const next = POC_MODES[(POC_MODES.indexOf(cursor) + 1) % POC_MODES.length]!;
        const ms = await c.switchTo(next);
        collected.push(ms);
        cursor = c.getMode();
        setMode(cursor);
        setLastMs(ms);
      }
      setSamples(collected);
      const s = summarizeTimings(collected);
      const bar = track === "A" ? TRACK_A_P95_MS : TRACK_B_P95_MS;
      const pass = track === "A" ? trackAPasses(s.p95) : trackBPasses(s.p95);
      const payload = {
        track,
        count: s.count,
        p50: round1(s.p50),
        p95: round1(s.p95),
        max: round1(s.max),
        barMs: bar,
        pass,
        samples: collected.map(round1)
      };
      setRunLog(JSON.stringify(payload, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openPanel = () => {
    const id = token(controllerRef.current?.getGameIdentity() ?? null);
    setGameIdBeforePanel(id);
    setPanelOpen(true);
  };

  const closePanel = () => {
    const id = token(controllerRef.current?.getGameIdentity() ?? null);
    setGameIdAfterPanel(id);
    setIdentityStable(gameIdBeforePanel !== null && gameIdBeforePanel === id);
    setPanelOpen(false);
  };

  const copyTimings = async () => {
    if (!runLog) return;
    try {
      await navigator.clipboard.writeText(runLog);
    } catch {
      /* ignore */
    }
  };

  const passA = track === "A" && summary.count > 0 ? trackAPasses(summary.p95) : null;
  const passB = track === "B" && summary.count > 0 ? trackBPasses(summary.p95) : null;

  return (
    <div className="flex flex-col gap-3" data-testid="phaser-scene-poc">
      <p className="text-sm text-muted">
        Phaser 4.2 scene-switch POC. Track A = one Game + <code>scene.switch</code>. Track B =
        destroy → createGame. Bars: A p95 ≤ {TRACK_A_P95_MS.toFixed(1)} ms, B p95 ≤ {TRACK_B_P95_MS}{" "}
        ms. Dual-plane: panel must not recreate Game on Track A.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Track</span>
        {(["A", "B"] as const).map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`phaser-scene-poc-track-${t}`}
            disabled={busy}
            title={busy ? "Busy — a scene switch or timing run is in progress" : undefined}
            onClick={() => void onTrackChange(t)}
            className={`rounded-sm border px-2 py-1 text-xs ${
              track === t ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted"
            }`}
          >
            Track {t}
          </button>
        ))}
        <span className="text-xs text-muted ml-2">Mode</span>
        {POC_MODES.map((m) => (
          <button
            key={m}
            type="button"
            data-testid={`phaser-scene-poc-mode-${m}`}
            disabled={busy}
            title={busy ? "Busy — a scene switch or timing run is in progress" : undefined}
            onClick={() => void switchMode(m)}
            className={`rounded-sm border px-2 py-1 text-xs capitalize ${
              mode === m ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted"
            }`}
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          data-testid="phaser-scene-poc-run20"
          disabled={busy}
          title={busy ? "Busy — a scene switch or timing run is in progress" : undefined}
          onClick={() => void runTwenty()}
          className="rounded-sm border border-border px-2 py-1 text-xs text-text hover:bg-panel"
        >
          Run 20 switches
        </button>
        <button
          type="button"
          data-testid="phaser-scene-poc-panel-open"
          disabled={busy || track !== "A"}
          title={
            busy
              ? "Busy — a scene switch or timing run is in progress"
              : track !== "A"
                ? "The GG-11 panel check only applies to Track A"
                : undefined
          }
          onClick={openPanel}
          className="rounded-sm border border-border px-2 py-1 text-xs text-text hover:bg-panel disabled:opacity-40"
        >
          Open GG-11 panel
        </button>
      </div>

      <div
        className="grid gap-2 rounded-sm border border-border bg-soil-raised px-3 py-2 text-xs font-mono text-text"
        data-testid="phaser-scene-poc-metrics"
      >
        <div>
          last: {lastMs == null ? "—" : `${lastMs.toFixed(1)} ms`} · samples: {summary.count} · p50:{" "}
          {fmt(summary.p50)} · p95: {fmt(summary.p95)} · max: {fmt(summary.max)}
        </div>
        <div>
          Track {track} bar:{" "}
          {track === "A"
            ? passA == null
              ? "n/a"
              : passA
                ? "PASS"
                : "FAIL"
            : passB == null
              ? "n/a"
              : passB
                ? "PASS"
                : "FAIL"}
          {identityStable != null && (
            <>
              {" "}
              · GG-11 identity: {identityStable ? "STABLE" : "CHANGED"} (before {gameIdBeforePanel} →
              after {gameIdAfterPanel})
            </>
          )}
        </div>
        {error && <div className="text-danger">error: {error}</div>}
      </div>

      <div
        ref={parentRef}
        data-testid="phaser-scene-poc-canvas"
        className="h-[min(50vh,420px)] min-h-[240px] w-full overflow-hidden rounded-sm border border-border bg-soil"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="phaser-scene-poc-copy"
          disabled={!runLog}
          title={!runLog ? "No timing run yet — run Track A or B first" : undefined}
          onClick={() => void copyTimings()}
          className="rounded-sm border border-border px-2 py-1 text-xs text-text hover:bg-panel disabled:opacity-40"
        >
          Copy timings JSON
        </button>
      </div>
      {runLog && (
        <pre
          data-testid="phaser-scene-poc-json"
          className="max-h-48 overflow-auto rounded-sm border border-border bg-soil p-2 text-[10px] text-muted"
        >
          {runLog}
        </pre>
      )}

      {panelOpen && (
        <div
          // band-panel, never a private tier (band GG-5): this demo panel sits on the
          // panel tier (200) like every other panel — a private value below hud would slide it under.
          className="band-panel fixed inset-0 flex items-center justify-center bg-black/50"
          data-testid="phaser-scene-poc-panel"
        >
          <div className="max-w-sm rounded-sm border border-border bg-soil-raised p-4 shadow-lg">
            <p className="font-display text-lg text-text">GG-11 panel</p>
            <p className="mt-1 text-sm text-muted">
              Overlay only — Track A Game must keep the same identity when this closes.
            </p>
            <button
              type="button"
              data-testid="phaser-scene-poc-panel-close"
              className="mt-3 rounded-sm border border-border px-3 py-1 text-sm text-text hover:bg-panel"
              onClick={closePanel}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return Number.isFinite(n) ? `${n.toFixed(1)} ms` : "—";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const gameTokens = new WeakMap<object, string>();
let gameTokenSeq = 0;

function token(id: object | null): string | null {
  if (!id) return null;
  let t = gameTokens.get(id);
  if (!t) {
    t = `g${++gameTokenSeq}`;
    gameTokens.set(id, t);
  }
  return t;
}
