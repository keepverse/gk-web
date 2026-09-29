/** UniqueActor Cold phase gates for roster FE (matches Server TryBegin/TryRetire). */

export function canDeploy(phase: string): boolean {
  return phase === "Roster";
}

export function canEquip(phase: string): boolean {
  return phase === "Roster";
}

export function canAwardXp(phase: string): boolean {
  return phase !== "Retired";
}

export function canRetire(phase: string): boolean {
  return phase !== "Deploying" && phase !== "Recovering" && phase !== "Retired";
}
