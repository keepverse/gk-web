import { formatMagnitude } from "@/i18n/magnitude";
import type { Magnitude } from "@/contract/types";
import { displayNameOf, type NotifyArg, type NotifyArgKind, type NotifyCategoryId, type NotifyRefKind } from "../catalog";

/** A domain supplies this - only the domain that owns a category knows how to name its own
 * references (notify-format spec §1: "a resolver the domain supplies"). Returns `null`/`undefined`
 * for an unresolvable reference; the kit renders `Pending` rather than the raw id (GG-23, GG-62). */
export type NotifyRefResolver = (ref: { refKind: NotifyRefKind; id: string }) => string | null | undefined;

/** notify-format spec §2 - the shared primitives, built on the web's existing number formatter and
 * i18n. There is deliberately no `domainToken` primitive (§2: "that kind is opaque to shared code
 * by definition") - only the owning domain's translator may read a domainToken arg's raw value. */
export interface NotifyFormatKit {
  magnitude(arg: NotifyArg): string;
  count(arg: NotifyArg): string;
  turn(arg: NotifyArg): string;
  turnsFrom(arg: NotifyArg, now: number): string;
  ref(arg: NotifyArg, resolver: NotifyRefResolver): string;
  categoryName(id: NotifyCategoryId): string;
}

function expectKind(arg: NotifyArg, kind: NotifyArgKind): void {
  if (arg.kind !== kind) {
    throw new Error(`notify/format kit: expected arg "${arg.name}" to be kind "${kind}", got "${arg.kind}"`);
  }
}

export const defaultFormatKit: NotifyFormatKit = {
  magnitude(arg) {
    expectKind(arg, "magnitude");
    return formatMagnitude(arg.value as Magnitude);
  },
  count(arg) {
    expectKind(arg, "count");
    return formatMagnitude({ unit: "count", value: arg.value as number });
  },
  turn(arg) {
    expectKind(arg, "worldTurn");
    return `turn ${arg.value as number}`;
  },
  turnsFrom(arg, now) {
    expectKind(arg, "worldTurn");
    const delta = (arg.value as number) - now;
    return delta <= 0 ? "this turn" : `in ${delta} turn${delta === 1 ? "" : "s"}`;
  },
  ref(arg, resolver) {
    expectKind(arg, "ref");
    const value = arg.value as { refKind: NotifyRefKind; id: string };
    return resolver(value) ?? "Pending";
  },
  categoryName(id) {
    return displayNameOf(id);
  }
};

/** notify-format spec §Testing 1: every closed `NotifyArgKind` except `domainToken` maps to a
 * primitive here. If `NotifyArgKind` (../catalog.ts) gains a member, this `satisfies` fails to
 * compile until a primitive is added for it - the "adding a kind without a primitive fails" rule,
 * enforced by `npm run build`'s type check rather than a runtime array. */
export const NOTIFY_ARG_KIND_PRIMITIVE = {
  magnitude: "magnitude",
  count: "count",
  worldTurn: "turn",
  ref: "ref"
} as const satisfies Record<Exclude<NotifyArgKind, "domainToken">, keyof NotifyFormatKit>;
