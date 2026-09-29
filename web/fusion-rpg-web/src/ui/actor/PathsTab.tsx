import type { Pending } from "@/contract/pending";
import type { ElementId } from "@/contract/types";
import { PassivesTab } from "./PassivesTab";

/** Catalog kind `paths` mounts the shipped PassivesTab body — not a separate passives kind. */
export function PathsTab({
  elementTyping
}: {
  elementTyping?: Pending<{ primary: ElementId; secondary?: ElementId }>;
}) {
  return (
    <div data-testid="paths-tab">
      <PassivesTab elementTyping={elementTyping} />
    </div>
  );
}
