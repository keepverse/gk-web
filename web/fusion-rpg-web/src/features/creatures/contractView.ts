/**
 * Contract display math (spec-creature-contracts.md) — mirrors ContractPolicy server-side, vitest-pinned
 * like patronView so drift shows up in CI. The server stays authoritative for real values; this is
 * only what the roster needs to draw before the next fetch lands.
 */

import type { ContractRowDto, ContractStateDto } from "../../lib/bus/contracts";

export const CONTRACT_DEPLOY_FLOOR = 200;
export const CONTRACT_LOYALTY_MAX = 1000;

export const LOYALTY_RANK_LABELS: Record<string, string> = {
  insubordinate: "Insubordinate",
  bound: "Bound",
  sworn: "Sworn",
  trusted: "Trusted",
  devoted: "Devoted"
};

export type ContractCondition = "unbound" | "insubordinate" | "bound";

/** The three states a creature can be in, and the only ones a picker needs to distinguish. */
export function conditionOf(row: ContractRowDto | undefined): ContractCondition {
  if (!row || !row.bound) return "unbound";
  return row.deployable ? "bound" : "insubordinate";
}

/** Why a picker greys a creature out — null when it can be fielded. */
export function fieldingBlockReason(row: ContractRowDto | undefined): string | null {
  switch (conditionOf(row)) {
    case "unbound":
      return "No contract — bind it first";
    case "insubordinate":
      return "Insubordinate — perform a pact ritual";
    default:
      return null;
  }
}

export function rankLabel(rank: string): string {
  return LOYALTY_RANK_LABELS[rank] ?? rank;
}

/** Fraction of the loyalty bar to fill, 0..1. */
export function loyaltyFraction(loyalty: number, max = CONTRACT_LOYALTY_MAX): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, loyalty / max));
}

/** "18 / 24 slots · next 900 Souls · 84 Souls/day" */
export function capacityLabel(state: ContractStateDto): string {
  const { used, total, nextSlotPrice, canBuy } = state.capacity;
  const next = canBuy ? ` · next ${nextSlotPrice} Souls` : " · all slots bought";
  return `${used} / ${total} slots${next} · ${state.dailyTribute} Souls/day`;
}

export function contractIndex(state: ContractStateDto | undefined): Record<string, ContractRowDto> {
  const index: Record<string, ContractRowDto> = {};
  for (const row of state?.contracts ?? []) index[row.instanceId] = row;
  return index;
}
