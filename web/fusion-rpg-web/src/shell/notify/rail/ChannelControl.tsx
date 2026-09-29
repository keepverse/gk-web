import { useEffect, useState } from "react";
import type { NotifyCategoryId, NotifyChannel } from "@/shell/notify/catalog";
import { CHANNEL_SETTINGS_CHANGED_EVENT, channelFor, setChannel } from "@/shell/notify/channelSettings";

export type ChannelControlProps = {
  category: NotifyCategoryId;
  /** True for a blocking rail item — visible but locked, never hidden (GG-55: the player learns the
   * rule instead of wondering why the switch did nothing). */
  locked?: boolean;
};

const CHANNELS: readonly { value: NotifyChannel; label: string }[] = [
  { value: "toast", label: "Toast" },
  { value: "rail", label: "Rail" },
  { value: "off", label: "Off" }
];

/**
 * world-stage W88 (spec-world-notify.md §6) — "Show ⟨category⟩ as… Toast · Rail · Off", applied to
 * the category and never to just this one message. Mounted both on a notification and in settings;
 * every mounted instance reads `shell/notify/channelSettings.ts`'s own shared store and re-syncs on
 * its change event, so two instances showing the same category can never disagree.
 *
 * The store is the ONE channel store now (notify-client §3): the world copy shares its storage key,
 * so a player's saved choices are read here unchanged, and a category outside the old eight works
 * because the store is keyed by the open `NotifyCategoryId`. Moved here beside the rail it serves
 * (world-notify-source §4); the store switch landed with `railStore.ts`'s widened category type.
 */
export function ChannelControl({ category, locked = false }: ChannelControlProps) {
  const [channel, setChannelState] = useState<NotifyChannel>(() => channelFor(category));

  useEffect(() => {
    setChannelState(channelFor(category));
    const sync = () => setChannelState(channelFor(category));
    window.addEventListener(CHANNEL_SETTINGS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CHANNEL_SETTINGS_CHANGED_EVENT, sync);
  }, [category]);

  return (
    <div role="group" aria-label={`Show ${category} as`} data-testid={`channel-control-${category}`}>
      {CHANNELS.map((c) => (
        <button
          key={c.value}
          type="button"
          aria-pressed={channel === c.value}
          disabled={locked}
          title={locked ? "Locked while this item blocks the turn" : undefined}
          onClick={() => setChannel(category, c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
