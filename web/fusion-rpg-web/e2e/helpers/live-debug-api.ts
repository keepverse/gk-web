import {
  entityMeetsActorHudPollCriteria,
  findActorHudEntity,
  parseBoardStatsPayload,
  type BoardEntityCore
} from "./live-debug-api-core";

const API_BASE = (process.env.FUSIONRPG_API_BASE ?? "http://127.0.0.1:5088").replace(/\/$/, "");

export type HealthResponse = {
  ok?: boolean;
  injectorConnected?: boolean;
};

export type QuickStartResponse = {
  ok: boolean;
  targetPtr?: string | null;
  plantPtr?: string | null;
  error?: string;
};

export type BoardEntity = BoardEntityCore;

type EventItem = {
  id?: number;
  kind?: string;
  payload?: unknown;
};

type EventsPage = { items?: EventItem[] };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`${path} ${r.status}: ${text.slice(0, 200)}`);
  }
  if (!r.ok) {
    const err = (data as { error?: string }).error ?? text.slice(0, 200);
    throw new Error(`${path} ${r.status}: ${err}`);
  }
  return data;
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
}

export async function assertInjectorHealth(): Promise<HealthResponse> {
  const health = await getJson<HealthResponse>("/health");
  if (!health.injectorConnected) {
    throw new Error("injector not connected — start game with FusionRpg injector loaded");
  }
  return health;
}

export async function waitForApiHealth(timeoutMs = 15_000): Promise<HealthResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const health = await getJson<HealthResponse>("/health");
      if (health.ok) return health;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error("API health check timed out");
}

export async function quickStartLabBoard(timeoutSec = 60): Promise<QuickStartResponse> {
  return postJson<QuickStartResponse>("/api/debug/lawn/quick-start", {
    scenario: "lab-overlay",
    levelNumber: 1,
    timeoutSec
  });
}

export async function grantShieldDemo(targetPtr: string, amount = 80) {
  return postJson("/api/debug/shield/demo", { targetPtr, amount });
}

export async function applyStatus(hostPtr: string, statusId: string, durationMs = 6000, amount = 20) {
  return postJson("/api/debug/status/apply", { hostPtr, statusId, durationMs, amount });
}

export async function requestBoardSnapshot() {
  return postJson("/api/debug/effect/board-snapshot", {});
}

export async function fetchEvents(afterId = 0, limit = 200): Promise<EventItem[]> {
  const page = await getJson<EventsPage>(`/api/events?afterId=${afterId}&limit=${limit}`);
  return page.items ?? [];
}

export async function pollBoardActorHud(
  targetPtr: string,
  opts: { timeoutMs?: number; minStatuses?: number } = {}
): Promise<BoardEntity> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const minStatuses = opts.minStatuses ?? 2;
  const deadline = Date.now() + timeoutMs;
  let afterId = 0;
  let attempt = 0;

  while (Date.now() < deadline) {
    if (attempt === 0 || attempt % 3 === 0) {
      try {
        await requestBoardSnapshot();
      } catch {
        /* injector may not be ready on first tick */
      }
    }
    attempt += 1;

    const items = await fetchEvents(afterId, 200);
    for (const ev of items) {
      if (ev.id != null && ev.id > afterId) afterId = ev.id;
      if (ev.kind !== "debug.board-stats") continue;
      const payload = parseBoardStatsPayload(ev.payload);
      if (!payload) continue;
      const ent = findActorHudEntity(payload, targetPtr);
      if (ent && entityMeetsActorHudPollCriteria(ent, minStatuses)) return ent;
    }
    await sleep(500);
  }

  throw new Error(
    `timed out waiting for debug.board-stats actorHud on ${targetPtr} (shield + ${minStatuses} statuses)`
  );
}

/** Full live lawn setup: quick-start → shield demo → two statuses → poll board-stats. */
export async function setupLiveActorHudBoard() {
  await assertInjectorHealth();
  const qs = await quickStartLabBoard(60);
  if (!qs.ok || !qs.targetPtr) {
    throw new Error(qs.error ?? "quick-start did not return targetPtr");
  }
  const targetPtr = qs.targetPtr;
  await grantShieldDemo(targetPtr);
  await applyStatus(targetPtr, "expose");
  await applyStatus(targetPtr, "command");
  const entity = await pollBoardActorHud(targetPtr);
  if (entity.row == null || entity.col == null) {
    throw new Error(`board-stats for ${targetPtr} missing row/col`);
  }
  return { targetPtr, row: entity.row, col: entity.col };
}

export { API_BASE };
