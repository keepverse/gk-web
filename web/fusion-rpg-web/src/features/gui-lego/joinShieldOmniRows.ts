/**
 * Join cook shield families → omni StatRow payloads for the Shield tab.
 * Spec: docs/architecture/shield-sheet/spec-shield-omni-rows.md
 */
import type { DerivedFamilyCatalogRow } from "@/lib/bus/actorSurface";
import type { ActorSheetChannelDto } from "@/lib/bus/aura";
import { formatDerivedMagnitude } from "./cook/formatDerivedMagnitude";
import type { PiecePayload } from "./types";

export type ShieldOmniJoinFamily = Pick<
  DerivedFamilyCatalogRow,
  "family" | "sheetGroup" | "expand" | "displayName" | "unitClass" | "reading" | "icon"
>;

/** Channel ids for shield omni rows — iterate cook, do not freeze a FE allow-list. */
export function listShieldOmniChannelIds(families: readonly ShieldOmniJoinFamily[]): string[] {
  return families
    .filter((f) => f.sheetGroup === "shield")
    .map((f) => (f.expand === "none" ? f.family : `${f.family}.omni`));
}

function omniChannelId(family: ShieldOmniJoinFamily): string {
  return family.expand === "none" ? family.family : `${family.family}.omni`;
}

/**
 * Join sheet derived channels to cook shield omni rows.
 * Missing wire → Pending (honest), never invent magnitudes.
 */
export function joinShieldOmniRows(input: {
  families: readonly ShieldOmniJoinFamily[];
  channels: readonly ActorSheetChannelDto[] | null | undefined;
}): PiecePayload[] {
  const byId = new Map((input.channels ?? []).map((c) => [c.channelId, c]));
  const rows: PiecePayload[] = [];

  for (const family of input.families) {
    if (family.sheetGroup !== "shield") continue;
    const channelId = omniChannelId(family);
    const live = byId.get(channelId);
    if (!live) {
      rows.push({
        piece: "channel-row",
        instanceId: `shield:omni:${channelId}`,
        phase: "pending",
        channelId,
        title: family.displayName,
        displayName: family.displayName,
        reading: family.reading ?? "",
        valueText: "Pending",
        state: "no-producer",
        renderState: "no-producer",
        kind: "plain",
        themeRef: { kind: "neutral", id: "neutral" },
        glyphRef: { catalogIcon: family.icon, fallbackText: family.displayName }
      });
      continue;
    }

    const valueText = formatDerivedMagnitude(live.value, live.unitClass || family.unitClass, {
      role: "total"
    }).valueText;

    rows.push({
      piece: "channel-row",
      instanceId: `shield:omni:${channelId}`,
      phase: "ready",
      channelId,
      title: live.displayName || family.displayName,
      displayName: live.displayName || family.displayName,
      reading: live.reading || family.reading || "",
      valueText,
      state: live.renderState || "active",
      renderState: live.renderState || "active",
      kind: "plain",
      themeRef: { kind: "neutral", id: "neutral" },
      glyphRef: { catalogIcon: family.icon, fallbackText: live.displayName || family.displayName }
    });
  }

  return rows;
}
