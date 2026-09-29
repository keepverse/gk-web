/** Phaser-safe API base mirror — React sets this from `@/lib/bus/rest` so game/ never imports HTTP helpers. */
let base = "";

export function setApiBaseMirror(value: string): void {
  base = value;
}

export function getApiBaseMirror(): string {
  return base;
}

export function resetApiBaseMirrorForTests(): void {
  base = "";
}
