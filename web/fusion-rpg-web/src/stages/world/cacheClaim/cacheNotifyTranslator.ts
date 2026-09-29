import type { NotifyTranslator, NotifyTarget } from "@/shell/notify/format/translator";
import type { NotifyFormatKit } from "@/shell/notify/format/kit";
import type { NotificationItem, NotifyArg } from "@/shell/notify/catalog";
import { sectorLabel } from "../labels";

/**
 * cache-notify-source spec §3 — the one reader of a `corpse-cache` notification's `place` argument.
 * Sentences are authored. `world_sector`/`world_lane` places arrive as a `ref`; `lawn`/`delve_room`/
 * `siege` arrive as a `domainToken` of the bare place-kind string (`CacheNotificationSource`'s own
 * documented convention, notification-ssot NS6.2).
 */

const SAMPLE = "s";

function findArg(args: readonly NotifyArg[], name: string): NotifyArg | undefined {
  return args.find((a) => a.name === name);
}

/** Only a `world_sector` place doubles as a target — a lane has no resolvable single-point
 * location on the map, and off-world places (lawn/delve/siege) have nothing on the world map to
 * target at all (`worldTranslator.ts`'s own precedent: only `sector` becomes a target). */
function placeTarget(args: readonly NotifyArg[]): NotifyTarget | undefined {
  const place = findArg(args, "place");
  if (!place || place.kind !== "ref") return undefined;
  const value = place.value as { refKind: string; id: string };
  return value.refKind === "sector" ? { refKind: "sector", id: value.id } : undefined;
}

/** `RpgStore.CorpseCachePlaceKinds`'s own closed vocabulary for the three off-world kinds. */
const OFF_WORLD_PLACE_WORDS: Record<string, string> = {
  lawn: "your lawn battle",
  delve_room: "your delve room",
  siege: "your siege"
};

function placeWords(args: readonly NotifyArg[], fmt: NotifyFormatKit): string {
  const place = findArg(args, "place");
  if (!place) return "an unknown place";
  if (place.kind === "domainToken") {
    return OFF_WORLD_PLACE_WORDS[place.value as string] ?? "an unknown place";
  }
  // ref: world_sector resolves through the world's own static sectorLabel; world_lane follows
  // laneLabel's rule (never split the raw id) but this translator has only the bare lane id, no
  // live endpoint lookup — it renders Pending, exactly as spec test 5 asks for.
  return fmt.ref(place, (ref) => (ref.refKind === "sector" ? sectorLabel(ref.id) : null));
}

function sample(messageKey: string, args: NotifyArg[], seq: number, category: string): NotificationItem {
  return {
    seq,
    rev: seq,
    dedupKey: `${SAMPLE}:${messageKey}:${seq}`,
    category,
    severity: "routine",
    sourceId: "cache-notify-source",
    messageKey,
    args,
    state: "unread",
    createdUtc: "2026-01-01T00:00:00Z"
  };
}

function countArg(name: string, value: number): NotifyArg {
  return { name, kind: "count", value };
}

function refArg(refKind: "sector" | "lane", id: string): NotifyArg {
  return { name: "place", kind: "ref", value: { refKind, id } };
}

function domainTokenArg(placeKind: string): NotifyArg {
  return { name: "place", kind: "domainToken", value: placeKind };
}

export const cacheNotifyTranslator: NotifyTranslator = {
  domain: "corpse-cache",

  translate(item, fmt) {
    if (item.messageKey === "cache.created") {
      const itemCountArg = findArg(item.args, "itemCount");
      const count = itemCountArg ? fmt.count(itemCountArg) : "some";
      const place = placeWords(item.args, fmt);
      return {
        title: fmt.categoryName(item.category),
        body: `${count} item(s) from a fallen legion are waiting at ${place}.`,
        target: placeTarget(item.args)
      };
    }
    if (item.messageKey === "cache.decayed") {
      const destroyedArg = findArg(item.args, "destroyed");
      const remainingArg = findArg(item.args, "remaining");
      const destroyed = destroyedArg ? fmt.count(destroyedArg) : "some";
      const remaining = typeof remainingArg?.value === "number" ? remainingArg.value : null;
      const place = placeWords(item.args, fmt);
      const body =
        remaining === 0
          ? `${destroyed} item(s) decayed at ${place} — nothing is left to recover.`
          : `${destroyed} item(s) decayed at ${place}.`;
      return { title: fmt.categoryName(item.category), body, target: placeTarget(item.args) };
    }
    return null;
  },

  samples(messageKey) {
    if (messageKey === "cache.created") {
      return [
        sample(messageKey, [countArg("itemCount", 3), domainTokenArg("lawn")], 1, "cache.created"),
        sample(messageKey, [countArg("itemCount", 1), domainTokenArg("delve_room")], 2, "cache.created"),
        sample(messageKey, [countArg("itemCount", 5), domainTokenArg("siege")], 3, "cache.created"),
        sample(messageKey, [countArg("itemCount", 2), refArg("sector", "ember-hollow")], 4, "cache.created"),
        sample(messageKey, [countArg("itemCount", 2), refArg("lane", "l-home-ember")], 5, "cache.created")
      ];
    }
    if (messageKey === "cache.decayed") {
      return [
        sample(messageKey, [countArg("destroyed", 1), countArg("remaining", 2), domainTokenArg("lawn")], 1, "cache.decayed"),
        sample(messageKey, [countArg("destroyed", 1), countArg("remaining", 0), refArg("sector", "ember-hollow")], 2, "cache.decayed")
      ];
    }
    return [];
  }
};
