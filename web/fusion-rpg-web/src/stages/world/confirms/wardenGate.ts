/**
 * world-stage W100 (`world-confirms` — plate 11 §K.2). Step 2's whole gate is a function of the
 * balance, never a flag someone remembers to set. `fee` and `upkeepPerDay` are the same real number
 * the engine charges (`ContractPolicy.UpkeepPerDay(rarity, personality)`, taken as the bind fee at
 * `RpgStore.Contracts.cs:316` and again as the recurring daily charge) — this function never
 * recomputes that rate itself, only asks whether the balance the caller already read (`SoulBalanceDto.
 * balance`, `lib/bus/creatures.ts:135-136`) can carry both the one-time fee and one more day's upkeep.
 * No store access, no React import — a plain arithmetic predicate the caller supplies real numbers to.
 */
export function needsSayItBack(balance: number, fee: number, upkeepPerDay: number): boolean {
  return balance < fee + upkeepPerDay;
}
