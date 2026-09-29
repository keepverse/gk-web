import { adaptExtraction } from "@/contract/adapt";
import type { ExtractionView } from "@/contract/types";

/**
 * D5.9 demo / dev-preview data only — **not a wire fixture**, matching `graph/fightFixture.ts`'s own
 * precedent and its own "why this is not a wire fixture" framing (D5.5). Built through the REAL
 * `adaptExtraction` (`contract/adapt.ts`), the same function a real endpoint would call the day one
 * exists, so every `Pending` field here carries the exact real reason production would produce today
 * (`wiped`/`firstClearGrant`/`levelUps`/`joins`, all `pendingWithReason(...)`) rather than an invented
 * one. Only `members`/`soulsFromKills`/`soulsFromVictory` are demo content — no producer exists
 * anywhere to source real ones from (`ExtractionSummary.tsx`'s own doc comment; no HTTP endpoint for
 * extraction exists on the server at all).
 *
 * Five members, chosen to exercise every real `SettlementOutcome` this stage can render: two `Roster`
 * (unharmed), one `Recover` (proves the "N more descents" phrase, and its plural), two `Retire` (proves
 * the folded-in permanent-loss notice actually fires, plural "2 members fell").
 */
export const DEMO_EXTRACTION: ExtractionView = adaptExtraction(
  [
    { instanceId: "demo-1", settlement: { outcome: "Roster", recoverDelves: 0, won: true } },
    { instanceId: "demo-2", settlement: { outcome: "Roster", recoverDelves: 0, won: true } },
    { instanceId: "demo-3", settlement: { outcome: "Recover", recoverDelves: 2, won: false } },
    { instanceId: "demo-4", settlement: { outcome: "Retire", recoverDelves: 0, won: false } },
    { instanceId: "demo-5", settlement: { outcome: "Retire", recoverDelves: 0, won: false } }
  ],
  { kills: 340, victory: 1200 }
);
