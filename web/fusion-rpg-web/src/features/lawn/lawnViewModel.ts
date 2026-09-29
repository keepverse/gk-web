/** Lawn projection types — content SSOT for FE lawn (DPLP). */

export type LawnSide = "plant" | "zombie";

/** Observe MatchPhase chrome — not an FE-owned game FSM. */
export type LawnPhase = "Idle" | "Starting" | "InMatch" | "Paused" | "Ending";

/** Poll board-stats while a match can still change occupancy. Ending is Idle on FE. */
export function shouldPollBoardStats(phase: LawnPhase): boolean {
  return phase === "InMatch" || phase === "Paused" || phase === "Starting";
}

export type OccupantFlags = {
  hypnotized?: boolean;
  mixed?: boolean;
  unique?: boolean;
  crashed?: boolean;
};

export type ActorHudTier = "normal" | "elite" | "boss" | "unique";
export type MagnitudeBand = "low" | "mid" | "high";

export type ActorHudSnapshot = {
  identity: {
    tier: ActorHudTier;
    role: string;
    levelBand?: number;
    flags: string[];
  };
  resources?: {
    shield?: {
      hp: number;
      max: number;
      stacks: { element: string; hp: number; max: number }[];
    };
    hpSliver?: { ratio: number };
    meters?: { id: string; ratio: number }[];
  };
  elements?: { primary: string; secondary?: string };
  statuses: {
    id: string;
    cc: boolean;
    magnitudeBand: MagnitudeBand;
  }[];
  overflow: { statusCount: number };
};

export type Occupant = {
  ptr: string;
  side: LawnSide;
  typeId: number;
  typeName?: string;
  row?: number;
  col?: number;
  hp?: number;
  maxHp?: number;
  /** Unity attack / theAttackDamage / attackDamage. */
  atk?: number;
  /** Unity armor/shield — not overlay defensePercent. */
  armor?: number;
  armorMax?: number;
  armor2?: number;
  armor2Max?: number;
  /** RPG shield resource (rpgShield* payload keys) — separate bar, never merged into armor. */
  rpgShield?: number;
  rpgShieldMax?: number;
  speed?: number;
  interval?: number;
  statusChips: string[];
  flags: OccupantFlags;
  /** Only from Snapshot Bindings observe — never invent. */
  instanceId?: string;
  /** Band B per-unit HUD — folded from injector actorHud wire only. */
  hud?: ActorHudSnapshot;
};

/** Grid item (crater, grave, ice, …) — not a living Occupant. */
export type LawnTile = {
  ptr: string;
  typeId: number;
  typeName?: string;
  row: number;
  col: number;
};

export type LawnMarkerKind = "mower" | "pet";

export type LawnMarker = {
  ptr: string;
  kind: LawnMarkerKind;
  typeId: number;
  typeName?: string;
  row?: number;
  col?: number;
  started?: boolean;
};

export type LawnCard = {
  typeId?: number;
  typeName?: string;
  side?: string;
};

export type LawnTravelBuff = {
  kind: string;
  name: string;
};

export type LawnLastEvent = {
  kind: string;
  summary: string;
};

export type LawnLastHit = {
  side?: string;
  damage?: number;
  targetPtr?: string;
  source?: string;
};

export type LawnEconomy = {
  sun?: number;
  money?: number;
  points?: number;
  wave?: number;
  maxWave?: number;
  hugeWave?: boolean;
};

export type LawnViewModel = {
  matchKey?: string;
  phase: LawnPhase;
  revision: number;
  rows: number;
  cols: number;
  /** cellKey = `${row},${col}` */
  cells: Map<string, Occupant[]>;
  orphans: Occupant[];
  /** ptr-keyed grid items */
  tiles: Map<string, LawnTile>;
  mowers: Map<string, LawnMarker>;
  pets: Map<string, LawnMarker>;
  hand: LawnCard[];
  travelBuffs: LawnTravelBuff[];
  levelName?: string;
  result?: string;
  lastInvade?: { ptr: string; typeId?: number; typeName?: string };
  lastAction?: LawnLastEvent;
  lastHit?: LawnLastHit;
  economy?: LawnEconomy;
  /** Frozen at board.start via debug.snapshot match.commander (commander-surface P3). */
  matchCommander?: {
    id: string;
    displayName: string;
    auraDisplayName: string | null;
  };
  /**
   * creature-lawn-deploy T2.4: the latest `lawn-deploy-event.fired` the fold has observed this match —
   * server truth only (fires once per case per run, per the injector's own evaluator). Whether the
   * player has already responded to THIS specific case is client-local UI state, deliberately not
   * carried here (LawnPage.tsx tracks a respondedCaseId alongside this field) — the fold stays a pure
   * reflection of server events, never owns "did the user dismiss this yet."
   */
  pendingLawnDeploy?: { caseId: string; eligibleInstanceIds: string[] } | null;
};

export const DEFAULT_ROWS = 5;
/** Canvas is 12×5: plantable 0–9 plus spawn lanes 10–11. */
export const DEFAULT_COLS = 12;

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function emptyLawnViewModel(
  partial?: Partial<Pick<LawnViewModel, "rows" | "cols" | "phase" | "revision" | "matchKey">>
): LawnViewModel {
  return {
    matchKey: partial?.matchKey,
    phase: partial?.phase ?? "Idle",
    revision: partial?.revision ?? 0,
    rows: partial?.rows ?? DEFAULT_ROWS,
    cols: partial?.cols ?? DEFAULT_COLS,
    cells: new Map(),
    orphans: [],
    tiles: new Map(),
    mowers: new Map(),
    pets: new Map(),
    hand: [],
    travelBuffs: [],
    economy: undefined
  };
}

/** Flatten living occupants (cells then orphans). */
export function listOccupants(model: LawnViewModel): Occupant[] {
  const out: Occupant[] = [];
  for (const list of model.cells.values()) out.push(...list);
  out.push(...model.orphans);
  return out;
}

export function findOccupant(model: LawnViewModel, ptr: string): Occupant | undefined {
  const want = normalizePtr(ptr);
  return listOccupants(model).find((o) => normalizePtr(o.ptr) === want);
}

export function listTiles(model: LawnViewModel): LawnTile[] {
  return [...model.tiles.values()];
}

export function findTile(model: LawnViewModel, ptr: string): LawnTile | undefined {
  const want = normalizePtr(ptr);
  return model.tiles.get(want);
}

export function tilesAt(model: LawnViewModel, row: number, col: number): LawnTile[] {
  return listTiles(model).filter((t) => t.row === row && t.col === col);
}

export function listMowers(model: LawnViewModel): LawnMarker[] {
  return [...model.mowers.values()];
}

export function listPets(model: LawnViewModel): LawnMarker[] {
  return [...model.pets.values()];
}

export function findMarker(model: LawnViewModel, ptr: string): LawnMarker | undefined {
  const want = normalizePtr(ptr);
  return model.mowers.get(want) ?? model.pets.get(want);
}

export function normalizePtr(ptr: string): string {
  return ptr.trim().toUpperCase();
}
