import { describe, expect, it } from "vitest";
import { EMBED_QUERY_KEY, EMBED_QUERY_VALUE, isEmbedded } from "./overlayEmbed";

/**
 * rift-gate decision 16: the embed marker is a **query flag**, not a hash fragment (this app uses a
 * HashRouter, so the hash is the router's own domain). A plain browser visit carries no marker and
 * must read as not-embedded — that is the honest-absence case the Leave control depends on.
 */
describe("overlayEmbed — the host's embed marker", () => {
  it("reads the marker from the query string", () => {
    expect(isEmbedded(`http://127.0.0.1:5088/?${EMBED_QUERY_KEY}=${EMBED_QUERY_VALUE}`)).toBe(true);
  });

  it("reads the marker when other query flags are present too", () => {
    expect(isEmbedded(`http://127.0.0.1:5088/?system=1&${EMBED_QUERY_KEY}=${EMBED_QUERY_VALUE}`)).toBe(true);
  });

  it("is not fooled by the hash — the router owns the hash", () => {
    // Same marker text in the fragment only: NOT embedded. A hash marker would be parsed as a route.
    expect(isEmbedded(`http://127.0.0.1:5088/?x=1#${EMBED_QUERY_KEY}=${EMBED_QUERY_VALUE}`)).toBe(false);
  });

  it("a plain browser visit reads as not embedded", () => {
    expect(isEmbedded("http://127.0.0.1:5088/")).toBe(false);
    expect(isEmbedded("http://127.0.0.1:5088/#/sanctum")).toBe(false);
  });

  it("requires the value, not just the key", () => {
    expect(isEmbedded(`http://127.0.0.1:5088/?${EMBED_QUERY_KEY}=0`)).toBe(false);
    expect(isEmbedded(`http://127.0.0.1:5088/?${EMBED_QUERY_KEY}=`)).toBe(false);
  });
});
