import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Anchor,
  Atom,
  Backpack,
  Ban,
  CircleDot,
  Crosshair,
  Eye,
  Flame,
  GitBranch,
  Heart,
  HeartPulse,
  Hexagon,
  Moon,
  Mountain,
  Shield,
  ShieldCheck,
  Sigma,
  Snowflake,
  Sparkles,
  Sun,
  Sword,
  Swords,
  Target,
  Virus,
  Wind,
  Zap
} from "lucide-react";
import { cn } from "@/lib/cn";

const LUCIDE_BY_KEY: Record<string, LucideIcon> = {
  heart: Heart,
  "heart-pulse": HeartPulse,
  zap: Zap,
  sun: Sun,
  sparkles: Sparkles,
  shield: Shield,
  "shield-check": ShieldCheck,
  sigma: Sigma,
  atom: Atom,
  backpack: Backpack,
  "git-branch": GitBranch,
  power: Sword,
  sword: Sword,
  swords: Swords,
  defense: Shield,
  crit: Crosshair,
  crosshair: Crosshair,
  "crit-resist": Target,
  target: Target,
  eye: Eye,
  anchor: Anchor,
  fire: Flame,
  flame: Flame,
  activity: Activity,
  hexagon: Hexagon,
  snowflake: Snowflake,
  ice: Snowflake,
  wind: Wind,
  air: Wind,
  mountain: Mountain,
  earth: Mountain,
  moon: Moon,
  dark: Moon,
  light: Sun,
  ban: Ban,
  virus: Virus,
  "yin-yang": CircleDot,
  qi: CircleDot
};

/**
 * Catalog `icon` / `hudToken` → lucide-react, with GG-58 generated fallback
 * (side/element tint + authored token text — never idWords).
 */
export function CatalogIcon({
  icon,
  fallbackToken,
  color,
  className,
  testId
}: {
  icon?: string | null;
  fallbackToken?: string | null;
  color?: string | null;
  className?: string;
  testId?: string;
}) {
  const key = (icon ?? "").trim().toLowerCase();
  const Lucide = key ? LUCIDE_BY_KEY[key] : undefined;
  if (Lucide) {
    return (
      <Lucide
        data-testid={testId}
        className={cn("h-4 w-4 shrink-0", className)}
        style={color ? { color } : undefined}
        aria-hidden
      />
    );
  }

  const glyph = (fallbackToken ?? icon ?? "·").slice(0, 2);
  return (
    <span
      data-testid={testId}
      aria-hidden
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-border-control bg-panel-inset font-display text-2xs uppercase text-text",
        className
      )}
      style={color ? { color, borderColor: color } : undefined}
    >
      {glyph}
    </span>
  );
}
