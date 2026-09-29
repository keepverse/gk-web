export const queryKeys = {
  health: ["health"] as const,
  players: ["players"] as const,
  stats: ["stats"] as const,
  cheats: ["cheats"] as const,
  cheatSchema: ["cheatSchema"] as const,
  cheatPacks: ["cheatPacks"] as const,
  pvzStats: (playerId: number) => ["pvzStats", playerId] as const,
  pvzStatsChannel: (playerId: number, channel: string) =>
    ["pvzStatsChannel", playerId, channel] as const,
  pvzActivity: (playerId: number) => ["pvzActivity", playerId] as const,
  pvzActivityFacts: (playerId: number) => ["pvzActivityFacts", playerId] as const,
  rpgProgressionSummary: (playerId: number) => ["rpgProgressionSummary", playerId] as const,
  rpgProgressionStats: (playerId: number) => ["rpgProgressionStats", playerId] as const,
  rpgProgressionActors: (playerId: number, kind?: string) =>
    ["rpgProgressionActors", playerId, kind ?? "all"] as const,
  rpgProgressionActor: (playerId: number, kind: string, typeId: number) =>
    ["rpgProgressionActor", playerId, kind, typeId] as const,
  rpgProgressionLedger: (
    playerId: number,
    filters?: { kind?: string; typeId?: number; reason?: string; afterId?: number; limit?: number }
  ) =>
    [
      "rpgProgressionLedger",
      playerId,
      filters?.kind ?? "all",
      filters?.typeId ?? "any",
      filters?.reason ?? "any",
      filters?.afterId ?? "head",
      filters?.limit ?? 100
    ] as const,
  types: ["types"] as const,
  recipes: ["recipes"] as const,
  metrics: ["metrics"] as const,
  runs: ["runs"] as const,
  runSpawns: (runId: number) => ["runSpawns", runId] as const,
  sim: ["sim"] as const,
  storageSummary: ["storage", "summary"] as const,
  storageArchives: ["storage", "archives"] as const,
  uniqueActor: (instanceId: string) => ["uniqueActor", instanceId] as const,
  uniqueActors: (playerId: number) => ["uniqueActors", playerId] as const,
  uniqueEquipment: (instanceId: string) => ["uniqueEquipment", instanceId] as const,
  relics: ["relics"] as const,
  aptitudes: (playerId: number) => ["aptitudes", playerId] as const,
  uniqueAptitudes: (instanceId: string) => ["uniqueAptitudes", instanceId] as const,
  speciesAptitudes: (playerId: number, speciesId: string) => ["speciesAptitudes", playerId, speciesId] as const,
  speciesRespecPrice: (playerId: number, speciesId: string) =>
    ["speciesRespecPrice", playerId, speciesId] as const,
  aptitudePresets: (playerId: number) => ["aptitudePresets", playerId] as const,
  aptitudePresetFavour: (speciesId: string) => ["aptitudePresetFavour", speciesId] as const,
  aptitudePresetActive: (playerId: number, scope: string, scopeKey: string) =>
    ["aptitudePresetActive", playerId, scope, scopeKey] as const,
  autoAssignRules: (scope: string) => ["autoAssignRules", scope] as const,
  commanders: (playerId: number) => ["commanders", playerId] as const,
  onboarding: (playerId: number) => ["onboarding", playerId] as const,
  passiveTree: (playerId: number) => ["passiveTree", playerId] as const,
  allSnapshots: [
    ["health"],
    ["players"],
    ["stats"],
    ["cheats"],
    ["types"],
    ["recipes"],
    ["metrics"],
    ["runs"],
    ["sim"],
    ["storage", "summary"],
    ["storage", "archives"],
    ["relics"]
  ] as const
};
