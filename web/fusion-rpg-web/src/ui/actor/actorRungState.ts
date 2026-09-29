import type { ActorView } from "@/contract/types";

/**
 * The four states every rung that shows data must have (T8). `ready` is the
 * only one that carries an `ActorView` — the other three are the shared
 * vocabulary every rung renders identically, so a caller wires a query
 * (`isLoading`/`isError`/no-data) or an unlock check into one of these
 * instead of inventing its own empty/error copy per rung.
 */
export type ActorRungState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "locked"; reason: string }
  | { kind: "ready"; data: ActorView };
