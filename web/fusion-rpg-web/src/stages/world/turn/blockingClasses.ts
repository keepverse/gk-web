export type BlockingEventKind = "legion.idle" | "loam.will-release";

/**
 * Events that HARD BLOCK the turn. Ships empty, and stays empty until an addition is argued in
 * spec-world-turn.md §2 and reviewed. ES2 shipped a battle notification into this class and
 * patched it back out; the default is the lesson.
 */
export const HARD_BLOCKING_EVENTS: readonly BlockingEventKind[] = [];

/** Events that NAG on attempt — they appear when you try to end, and never stop you. */
export const NAGGING_EVENTS: readonly BlockingEventKind[] = ["legion.idle", "loam.will-release"];
