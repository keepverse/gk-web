/** Sync grammar on model payloads (phaser-kernel board-contract freeze). */
export type SyncSeq =
  | { kind: "revision"; value: number }
  | { kind: "modelSeq"; value: number }
  | { kind: "playbackCursor"; value: number };
