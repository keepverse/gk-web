import type { NotifyTranslator, NotifyTarget } from "@/shell/notify/format/translator";
import type { NotificationItem, NotifyArg } from "@/shell/notify/catalog";
import { describePlaybackEntry, type PlaybackEntry } from "../playbackTable";
import { sectorLabel } from "../labels";

/**
 * world-notify-source spec §3 — the ONE reader of a `world` domainToken. Nothing else in the app
 * parses a report-entry token; every surface (toast, rail, centre) sees only this translator's
 * rendered `NotifyText`.
 *
 * **Wire convention this translator owns** (domainToken is opaque to shared code by definition,
 * `notify-format` kit.ts's own comment — the domain decides its shape): the `entry` argument's
 * `value` is the entry itself, `{kind, subject, detail, sectorId}` (`PlaybackEntry`'s own shape),
 * carried as a plain JSON object exactly like a `ref` argument's `{refKind, id}` value — not a
 * double-encoded JSON string. `WorldReportNotificationSource` (NS5.3, blocked on ask A2) MUST build
 * its draft's domainToken argument this same way, or this translator's `translate` below throws.
 */

const ENTRY_ARG_NAME = "entry";
const SECTOR_ARG_NAME = "sector";

function findArg(args: readonly NotifyArg[], name: string): NotifyArg | undefined {
  return args.find((a) => a.name === name);
}

function sectorTarget(args: readonly NotifyArg[]): NotifyTarget | undefined {
  const ref = findArg(args, SECTOR_ARG_NAME);
  if (!ref || ref.kind !== "ref") return undefined;
  const value = ref.value as { refKind: string; id: string };
  return value.refKind === "sector" ? { refKind: "sector", id: value.id } : undefined;
}

function turnEntryOf(item: NotificationItem): PlaybackEntry {
  const arg = findArg(item.args, ENTRY_ARG_NAME);
  if (!arg || arg.kind !== "domainToken") {
    throw new Error(`worldTranslator: "${item.messageKey}" is missing its "${ENTRY_ARG_NAME}" domainToken argument`);
  }
  return arg.value as PlaybackEntry;
}

function entry(kind: string, subject: string, detail: string, sectorId: string | null = null): PlaybackEntry {
  return { kind, subject, detail, sectorId };
}

function domainTokenArg(e: PlaybackEntry): NotifyArg {
  return { name: ENTRY_ARG_NAME, kind: "domainToken", value: e };
}

function sectorRefArg(sectorId: string): NotifyArg {
  return { name: SECTOR_ARG_NAME, kind: "ref", value: { refKind: "sector", id: sectorId } };
}

function sample(
  category: string,
  messageKey: string,
  args: NotifyArg[],
  seq = 1
): NotificationItem {
  return {
    seq,
    rev: seq,
    dedupKey: `sample:${category}:${seq}`,
    category,
    severity: "routine",
    sourceId: "world-notify-source",
    messageKey,
    args,
    state: "unread",
    createdUtc: "2026-01-01T00:00:00Z"
  };
}

export const worldTranslator: NotifyTranslator = {
  domain: "world",

  translate(item, fmt) {
    if (item.messageKey === "world.turn-entry") {
      const body = describePlaybackEntry(turnEntryOf(item));
      return { title: fmt.categoryName(item.category), body, target: sectorTarget(item.args) };
    }
    if (item.messageKey === "world.release-forecast") {
      const target = sectorTarget(item.args);
      const name = fmt.ref(
        findArg(item.args, SECTOR_ARG_NAME) ?? { name: SECTOR_ARG_NAME, kind: "ref", value: { refKind: "sector", id: "" } },
        (ref) => sectorLabel(ref.id)
      );
      return { title: fmt.categoryName(item.category), body: `${name} releases next turn.`, target };
    }
    return null;
  },

  samples(messageKey) {
    if (messageKey === "world.turn-entry") {
      // One per mapped classifier prefix (world-notify-source §2 / WorldTurnNotificationClassifier's
      // own row table), not merely one per category — a deleted or renamed playbackTable row breaks
      // ITS OWN sample here, not just the coverage guard's coarser per-category check.
      return [
        sample("loam.shortfall", messageKey, [domainTokenArg(entry("event", "f-dave", "loam.shortfall.unresolved:200"))], 1),
        sample("loam.shortfall", messageKey, [domainTokenArg(entry("event", "f-dave", "loam.shortfall:340", "s-weak"))], 2),
        sample("territory.lost", messageKey, [domainTokenArg(entry("event", "f-dave", "loam.lost:s-x", "s-x")), sectorRefArg("s-x")], 3),
        sample("legion.runway", messageKey, [domainTokenArg(entry("event", "e-dave-legion-1", "legion.runway:12", "s-x"))], 4),
        sample("supply.change", messageKey, [domainTokenArg(entry("event", "f-dave", "legion.topup:50"))], 5),
        sample("supply.change", messageKey, [domainTokenArg(entry("event", "e-dave-legion-1", "supply.restored", "s-x"))], 6),
        sample("supply.change", messageKey, [domainTokenArg(entry("event", "f-dave", "supply.besieged:s-x", "s-x")), sectorRefArg("s-x")], 7),
        sample("supply.change", messageKey, [domainTokenArg(entry("event", "f-dave", "supply.cut:s-x", "s-x")), sectorRefArg("s-x")], 8),
        sample("growth", messageKey, [domainTokenArg(entry("event", "s-x", "growth.pulse:3", "s-x")), sectorRefArg("s-x")], 9),
        sample("growth", messageKey, [domainTokenArg(entry("event", "s-x", "develop.completed:silo", "s-x")), sectorRefArg("s-x")], 10),
        sample("growth", messageKey, [domainTokenArg(entry("event", "s-x", "development.raised:5", "s-x")), sectorRefArg("s-x")], 11),
        sample("growth", messageKey, [domainTokenArg(entry("event", "c-1", "build.started:silo", "s-x")), sectorRefArg("s-x")], 12),
        sample("intel.new", messageKey, [domainTokenArg(entry("event", "f-dave", "intel.new:5"))], 13),
        sample("command.dropped", messageKey, [domainTokenArg(entry("command.dropped", "c-1", "entity.unknown"))], 14),
        sample("battle.result", messageKey, [domainTokenArg(entry("battle", "battle-1", "sector:s-x:e-winner", "s-x")), sectorRefArg("s-x")], 15)
      ];
    }
    if (messageKey === "world.release-forecast") {
      return [sample("loam.release", messageKey, [sectorRefArg("s-x")], 1)];
    }
    return [];
  }
};
