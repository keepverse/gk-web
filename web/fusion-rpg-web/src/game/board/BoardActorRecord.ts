/**
 * Cell-board actor record for siege/battle/lawn live apply (lock 5a freeze).
 * Magnitudes use bigint — never float (power ladder / overflow law).
 * Never carries lawn `ptr`.
 */
export type BoardActorRecord = {
  key: string;
  row: number;
  col: number;
  kind: string;
  /** Magnitude — bigint on FE contract; never float. */
  hp: bigint;
  isStructure: boolean;
  showInitiative: boolean;
};

export type BoardSelectPayload = {
  generation: number;
  kind: "cell" | "actor" | "structure";
  actorKey?: string;
  row?: number;
  col?: number;
  // NEVER ptr
};
