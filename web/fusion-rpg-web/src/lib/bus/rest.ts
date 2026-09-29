const DEV_API = "http://127.0.0.1:5088";

export function apiBase(): string {
  if (import.meta.env.DEV) return DEV_API;
  return "";
}

/** Prefer Server `reason` / `error` fields; else path + status. */
export async function httpErrorMessage(path: string, r: Response): Promise<string> {
  const fallback = `${path} ${r.status}`;
  try {
    const body = (await r.json()) as { reason?: unknown; error?: unknown };
    if (typeof body?.reason === "string" && body.reason.trim()) return body.reason.trim();
    if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
  } catch {
    /* non-JSON body */
  }
  return fallback;
}

export async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(apiBase() + path);
  if (!r.ok) throw new Error(await httpErrorMessage(path, r));
  return r.json() as Promise<T>;
}

export async function tryGetJson<T>(path: string): Promise<T | null> {
  const r = await fetch(apiBase() + path);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(await httpErrorMessage(path, r));
  return r.json() as Promise<T>;
}

export async function sendJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(apiBase() + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await httpErrorMessage(path, r));
  return r.json() as Promise<T>;
}
