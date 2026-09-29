/**
 * Structure HP chrome — not ActorHudDisplay (identity/shield/status).
 * Draws into layers.overlays only when a BoardLayers view is supplied.
 */
export type StructureHpBarArgs = {
  overlays: { add?: (child: unknown) => void } | null | undefined;
  key: string;
  hp: bigint;
  maxHp: bigint;
};

export function paintStructureHpBar(args: StructureHpBarArgs): void {
  if (args.hp < 0n || args.maxHp <= 0n) {
    throw new Error("[paintStructureHpBar] hp/maxHp must be non-negative bigint with maxHp > 0");
  }
  if (import.meta.env.DEV) {
    console.info("[paintStructureHpBar]", {
      event: "paint",
      key: args.key,
      hp: args.hp.toString(),
      maxHp: args.maxHp.toString()
    });
  }
  // Thin: real Graphics land with siege board scene (base-defense), not here.
}
