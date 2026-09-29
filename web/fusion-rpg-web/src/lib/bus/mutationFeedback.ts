import { MutationCache } from "@tanstack/react-query";
import { useToastStack } from "@/shell/toastStack";

type MutationMeta = { entity?: string; silent?: boolean };

/**
 * One listener, every mutation (T11) — `meta.entity` (set once per hook in
 * `mutations.ts`) is what names the toast; nothing at the call site has to
 * wire this itself. `meta.silent` opts a specific mutation *instance* — not
 * the hook itself — out entirely: the one real user of it today is
 * `LawnPage`'s ~1.5s board-stats poll, where a persistent connection banner
 * already covers "the server is unreachable" better than a toast repeating
 * every tick would (GG-16 is about failures being *visible*, not about
 * every ambient signal getting its own notification on top of one that
 * already exists).
 */
export function createMutationFeedbackCache(): MutationCache {
  return new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const meta = mutation.options.meta as MutationMeta | undefined;
      if (!meta?.entity || meta.silent) return;
      useToastStack.getState().push({ tone: "ok", title: `${meta.entity} updated` });
    },
    onError: (_error, _variables, _context, mutation) => {
      const meta = mutation.options.meta as MutationMeta | undefined;
      if (meta?.silent) return;
      const entity = meta?.entity ?? "Action";
      useToastStack.getState().push({
        tone: "bad",
        title: `${entity} update failed`,
        message: "Nothing changed."
      });
    }
  });
}
