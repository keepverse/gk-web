/**
 * Focus gate for Phaser keyboard (GG-18) — React layers own input when a panel is open.
 * LawnStage sets the mute flag; LawnWorldScene reads it via wireKeyboardNav isEnabled.
 * World keeps React→bus arrows (not this flag).
 */
let lawnKeyboardMuted = false;

export function setLawnKeyboardMuted(muted: boolean): void {
  lawnKeyboardMuted = muted;
}

export function isLawnKeyboardMuted(): boolean {
  return lawnKeyboardMuted;
}

export function resetLawnKeyboardMuteForTests(): void {
  lawnKeyboardMuted = false;
}
