import { describe, expect, it } from "vitest";
import { doorTreatmentFor } from "./doorKind";

const base = { typeId: "passage", gateKeyId: null as string | null, state: "Open" as const };

describe("doorTreatmentFor — the closed four-id door-kind vocabulary (data/seed/dungeon/_registry/door-kinds.v1.json)", () => {
  it("passage: plain, nothing special", () => {
    expect(doorTreatmentFor(base)).toEqual({ gated: false, oneWay: false, secret: false, severed: false });
  });

  it("gated: locked, by typeId alone (no gateKeyId assigned yet)", () => {
    expect(doorTreatmentFor({ ...base, typeId: "gated" })).toEqual({
      gated: true,
      oneWay: false,
      secret: false,
      severed: false
    });
  });

  it("a real gateKeyId is authoritative even if typeId disagrees — the real wire field beats the inferred one", () => {
    expect(doorTreatmentFor({ ...base, typeId: "passage", gateKeyId: "key-1" }).gated).toBe(true);
  });

  it("one-way: drives the arrowhead, not gated, not secret", () => {
    expect(doorTreatmentFor({ ...base, typeId: "one-way" })).toEqual({
      gated: false,
      oneWay: true,
      secret: false,
      severed: false
    });
  });

  it("secret: the hidden/dashed treatment", () => {
    expect(doorTreatmentFor({ ...base, typeId: "secret" })).toEqual({
      gated: false,
      oneWay: false,
      secret: true,
      severed: false
    });
  });

  it("severed reads from state, independently of typeId — a broken gate is still gated AND severed", () => {
    expect(doorTreatmentFor({ ...base, typeId: "gated", gateKeyId: "key-1", state: "Severed" })).toEqual({
      gated: true,
      oneWay: false,
      secret: false,
      severed: true
    });
  });

  it("an unrecognised typeId fails safe to plain, never throws (the registry could grow a fifth row)", () => {
    expect(doorTreatmentFor({ ...base, typeId: "some-future-kind" })).toEqual({
      gated: false,
      oneWay: false,
      secret: false,
      severed: false
    });
  });
});
