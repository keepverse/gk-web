import { useCallback, useEffect, useState } from "react";
import { useLawnDebugPost } from "@/lib/bus";
import { Button, Field, HelpText, TextInput } from "@/ui";

type ScreenshotInfo = {
  fileName: string;
  tag: string;
  bytes: number;
  takenAtUtc: string;
};

async function fetchInfo(): Promise<ScreenshotInfo | null> {
  const res = await fetch("/api/debug/screenshot/info");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`screenshot info -> ${res.status}`);
  return (await res.json()) as ScreenshotInfo;
}

/**
 * Latest-frame panel (live-probe module `lawn-screenshot`).
 * Game Injector Debug surface: shows what the engine renders, proves nothing about the
 * server. Trigger POSTs `screenshot` through the shared lawn debug mutation; the image
 * itself is served from the server side-store, never the events table.
 */
export function LawnScreenshotPanel() {
  const debugPost = useLawnDebugPost();
  const [tag, setTag] = useState("probe");
  const [info, setInfo] = useState<ScreenshotInfo | null>(null);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setInfo(await fetchInfo());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "screenshot info fetch failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const capture = useCallback(async () => {
    setCapturing(true);
    setError("");
    try {
      await debugPost.mutateAsync({ path: "screenshot", body: { tag } });
      // Capture runs end-of-frame in the game, then uploads; re-check after it lands.
      window.setTimeout(() => void refresh(), 3000);
      window.setTimeout(() => {
        setCapturing(false);
        void refresh();
      }, 7000);
    } catch (e) {
      setCapturing(false);
      setError(e instanceof Error ? e.message : "screenshot trigger failed");
    }
  }, [debugPost, refresh, tag]);

  const imgSrc = info
    ? `/api/debug/screenshot/latest?ts=${encodeURIComponent(info.takenAtUtc)}`
    : null;

  return (
    <div
      className="mt-4 space-y-2 border-t border-border pt-3"
      data-testid="lawn-screenshot-panel"
    >
      <p className="text-sm font-semibold text-text">Lawn screenshot</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="tag">
          <TextInput
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            data-testid="lawn-screenshot-tag"
          />
        </Field>
        <Button
          size="sm"
          disabled={capturing || debugPost.isPending}
          title={
            capturing || debugPost.isPending ? "Capture in flight…" : undefined
          }
          onClick={() => void capture()}
          data-testid="lawn-screenshot-capture"
        >
          {capturing ? "Capturing…" : "Capture frame"}
        </Button>
      </div>
      {imgSrc && info ? (
        <>
          <img
            src={imgSrc}
            alt={`live lawn frame (${info.tag})`}
            className="w-full rounded"
            data-testid="lawn-screenshot-img"
          />
          <HelpText data-testid="lawn-screenshot-meta">
            {info.tag} · {info.bytes}B · {info.takenAtUtc}
          </HelpText>
        </>
      ) : (
        <HelpText data-testid="lawn-screenshot-empty">
          No screenshot stored yet — capture a frame to see the live lawn.
        </HelpText>
      )}
      {error ? <HelpText data-testid="lawn-screenshot-error">{error}</HelpText> : null}
    </div>
  );
}
