import { StorySceneHost } from "@/ui/story-scene/StorySceneHost";
import { RIFT_PROLOGUE_SCRIPT, type StoryCueId } from "@/features/story-scene/sceneScript";

export type RiftPrologueCueId = StoryCueId;

/**
 * Thin wrapper: the prologue's trigger contract (open/playerId/close/continue/cue) stays exactly
 * as `SanctumStage` and the tests know it. Everything else — beat index, guards, acknowledgement,
 * error recovery, fold, mount — lives in `StorySceneHost`, which is shared by every scene.
 */
export function RiftPrologueDialog({
  open,
  playerId,
  onClose,
  onContinueToLawn,
  onCue
}: {
  open: boolean;
  playerId: number;
  onClose: () => void;
  /** Existing lawn destination; used by successful and degraded completion alike. */
  onContinueToLawn?: () => void;
  /** Presentation seam: the shared VFX host may consume this semantic cue; absent is safe. */
  onCue?: (cueId: RiftPrologueCueId) => void;
}) {
  return (
    <StorySceneHost
      script={RIFT_PROLOGUE_SCRIPT}
      playerId={playerId}
      open={open}
      onClose={onClose}
      onContinue={onContinueToLawn}
      onCue={onCue}
      // Instance identity: the dialog keeps its shipped test hook, so the Sanctum trigger test
      // and the visual-evidence capture scope the same node before and after the cutover.
      testId="rift-prologue-dialog"
    />
  );
}
