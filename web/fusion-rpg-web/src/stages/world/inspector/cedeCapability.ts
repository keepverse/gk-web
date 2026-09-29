/**
 * Whether the engine's own command vocabulary carries a `cede` kind (world-stage W59/W60).
 *
 * **Found stale 2026-09-04, before this module was even built**: this task's own description text
 * (and `spec-world-inspector.md` §3) was written against `WorldCommand.All` having *no* cede kind —
 * true when that prose was drafted, but `world-commands` W24 ("The `cede` command kind and its
 * admission arm", already `[x]` earlier in this same program) landed `WorldCommandKinds.Cede =
 * "cede"` and appended it to `All` (`WorldCommand.cs:41,53-54`) before W59/W60 were ever reached.
 * Read the real file rather than trusting the task prose — the premise the "embargo" was written to
 * enforce no longer holds.
 *
 * This constant is not free-standing: `cedeEmbargo.test.ts` (W60) reads `WorldCommand.cs` directly
 * and fails if this value ever drifts from the real vocabulary again, in either direction.
 */
export const CEDE_ORDER_AVAILABLE = true;
