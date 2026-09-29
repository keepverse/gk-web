import { afterEach, describe, expect, it } from "vitest";
import { domainOf } from "@/shell/notify/catalog";
import { resetNotificationFeedForTests, useNotificationFeed } from "@/shell/notify/feed/feedStore";
import type { RailItem } from "@/shell/notify/rail/railStore";
import { captureLoserToast } from "../cacheClaim/captureNotice";
import {
  resetLegacyCaptureLossForTests,
  useLegacyCaptureLoss,
  worldRailRows
} from "./legacyCaptureLoss";

/** The loser's edge: the viewer held the vault on the previous read and somebody else holds it now. */
const LOST = {
  sectorId: "ember-hollow",
  ownerFactionId: "dave",
  viewerFactionId: "rhea",
  previousOwnerFactionId: "rhea"
};

const notice = () => captureLoserToast(LOST)!;
const localRows = () => useLegacyCaptureLoss.getState().items;

function feedRow(over: Partial<RailItem> = {}): RailItem {
  return {
    id: "server-1",
    dedupKey: "server-1",
    seq: 7,
    category: "growth",
    severity: "routine",
    title: "Ash Waste grew a rootbed",
    body: "",
    state: "unread",
    worldId: "w1",
    worldTurn: 4,
    blocking: false,
    ...over
  };
}

afterEach(() => {
  resetLegacyCaptureLossForTests();
  resetNotificationFeedForTests();
});

describe("legacyCaptureLoss — the named debt adapter (world-notify-source §Debt, step 1)", () => {
  it("a captured vault produces one local row, under the catalogue's own territory.lost", () => {
    const item = notice();
    expect(item).not.toBeNull(); // the producer decided this is the loser's story
    useLegacyCaptureLoss.getState().adopt(item);

    const rows = localRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.category).toBe("territory.lost");
    // The id is a real catalogue row, not a private vocabulary of this adapter's own.
    expect(domainOf(rows[0]!.category)).toBe("world");
    // Never durable: no server seq, no turn, nothing to catch up on.
    expect(rows[0]!.seq).toBeNull();
    expect(rows[0]!.worldId).toBeNull();
    expect(rows[0]!.worldTurn).toBeNull();
    expect(rows[0]!.blocking).toBe(false);
  });

  it("the notice never enters the feed — the feed is the server's own rows", () => {
    useLegacyCaptureLoss.getState().adopt(notice());

    expect(Object.keys(useNotificationFeed.getState().byKey)).toEqual([]);
    expect(useNotificationFeed.getState().maxRev).toBe(0);
    expect(useNotificationFeed.getState().playerId).toBeNull();
  });

  it("the same sector twice in one session is still one notice", () => {
    useLegacyCaptureLoss.getState().adopt(notice());
    useLegacyCaptureLoss.getState().adopt(notice());

    expect(localRows()).toHaveLength(1);
  });

  it("opening and dismissing are the rail store's own transitions, over the local list", () => {
    useLegacyCaptureLoss.getState().adopt(notice());
    const id = localRows()[0]!.id;

    useLegacyCaptureLoss.getState().open(id);
    expect(localRows()[0]!.state).toBe("opened");

    useLegacyCaptureLoss.getState().dismiss(id);
    expect(localRows()[0]!.state).toBe("dismissed");
  });

  it("the rail renders the feed's rows then the local notices, and the feed array is untouched", () => {
    useLegacyCaptureLoss.getState().adopt(notice());
    const feedRows = [feedRow()];

    const rendered = worldRailRows(feedRows, localRows());

    expect(rendered.map((r) => r.id)).toEqual(["server-1", localRows()[0]!.id]);
    expect(feedRows).toHaveLength(1); // the adapter appended to what is rendered, never to what is stored
  });
});
