/**
 * Snapshot CSS custom properties once at Game boot into a Phaser-friendly record.
 * hexGuard skips `game/` because `var(--*)` cannot resolve in WebGL — this is the bridge.
 */

export type WorldTheme = {
  soil: string;
  panel: string;
  sun: string;
  ink: string;
  sidePlant: string;
  sideZombie: string;
  fontFamily: string;
};

const FALLBACK: WorldTheme = {
  soil: "#16120e",
  panel: "#2a241c",
  sun: "#e8c547",
  ink: "#f2ebe0",
  sidePlant: "#6fbf73",
  sideZombie: "#c45c5c",
  fontFamily: "Georgia, 'Noto Serif', serif"
};

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const v = styles.getPropertyValue(name).trim();
  return v || fallback;
}

/** Read computed tokens from `document.documentElement`. Safe under jsdom (falls back). */
export function snapshotTheme(root: HTMLElement = document.documentElement): WorldTheme {
  try {
    const styles = getComputedStyle(root);
    return {
      soil: readVar(styles, "--soil", FALLBACK.soil),
      panel: readVar(styles, "--panel", FALLBACK.panel),
      sun: readVar(styles, "--sun", FALLBACK.sun),
      ink: readVar(styles, "--ink", FALLBACK.ink),
      sidePlant: readVar(styles, "--side-plant", FALLBACK.sidePlant),
      sideZombie: readVar(styles, "--side-zombie", FALLBACK.sideZombie),
      fontFamily: readVar(styles, "--font-body", FALLBACK.fontFamily)
    };
  } catch {
    return { ...FALLBACK };
  }
}

export const WORLD_THEME_FALLBACK = FALLBACK;
