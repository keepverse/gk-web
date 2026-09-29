import type { MemberView } from "@/contract/types";
import { cn } from "@/lib/cn";
import { nerveStageLabel } from "@/stages/delve/labels";
import { PoolMeters } from "./PoolMeters";

/**
 * One party member (D5.6). "Down" is spec-delve-stage.md §8 row 6's own literal player word for the
 * `Downed` wire flag — reused here, not invented, and distinct from `Retired`/`Fallen`, which
 * `labels.ts`'s own header names as a real, separate, unresolved mismatch this task does not touch
 * (that word belongs to `ExtractionSettlement`'s post-run outcome, not this live, in-room boolean).
 * Beyond the acceptance line's own literal "pool meters and the nerve stage" — a genuinely cheap,
 * real, already-tested field (`MemberView.downed`) that changes what the meters next to it mean, named
 * here rather than silently added without comment.
 */
export function MemberRow({ member }: { member: MemberView }) {
  return (
    <li
      data-testid={`delve-member-${member.instanceId}`}
      className={cn("rounded border border-border bg-panel-inset p-1.5", member.downed && "opacity-70")}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        {member.downed ? (
          <span
            data-testid={`delve-member-downed-${member.instanceId}`}
            className="rounded-pill bg-bad-solid px-1.5 py-0.5 text-2xs text-text"
          >
            Down
          </span>
        ) : (
          <span />
        )}
        {member.nerveStage.state === "known" ? (
          <span data-testid={`delve-member-nerve-${member.instanceId}`} className="text-2xs text-muted">
            {nerveStageLabel(member.nerveStage.value)}
          </span>
        ) : (
          <span
            data-testid={`delve-member-nerve-pending-${member.instanceId}`}
            className="text-2xs italic text-muted"
          >
            {member.nerveStage.state === "pending" ? member.nerveStage.reason : "No word on this one's nerve"}
          </span>
        )}
      </div>
      <PoolMeters pools={member.pools} poolFill={member.poolFill} />
    </li>
  );
}
