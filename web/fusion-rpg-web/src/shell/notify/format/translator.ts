import type { NotificationItem, NotifyRefKind } from "../catalog";
import type { NotifyFormatKit } from "./kit";

export type NotifyTarget = { refKind: NotifyRefKind; id: string };

export type NotifyText = {
  /** Authored copy. Never an id, never an engine token (GG-23 / GG-62). */
  title: string;
  body: string;
  /** Optional. The mount decides whether a target becomes an action (notify-client §Design 6). */
  target?: NotifyTarget;
};

/** One per domain. Owns that domain's message keys and is the ONLY reader of its domainToken args
 * (notify-format spec §1). */
export type NotifyTranslator = {
  domain: string;
  /** null = unknown key -> the designed fallback (render.ts). */
  translate(item: NotificationItem, fmt: NotifyFormatKit): NotifyText | null;
  /** Representative items per message key, for the coverage guard (§Testing 3). Test-facing only. */
  samples(messageKey: string): readonly NotificationItem[];
};
