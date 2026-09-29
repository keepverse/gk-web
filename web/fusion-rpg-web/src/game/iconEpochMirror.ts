/**
 * Phaser-side icon epoch mirror — React owns the epoch source (@/lib/bus/icon-epoch).
 * Hosts push updates via lawn:iconEpoch (or setIconEpochMirror) so game/ never imports lib/bus.
 */
let epoch = 0;

export function setIconEpochMirror(value: number): void {
  epoch = value >>> 0;
}

export function getIconEpochMirror(): number {
  return epoch;
}

export function resetIconEpochMirrorForTests(): void {
  epoch = 0;
}
