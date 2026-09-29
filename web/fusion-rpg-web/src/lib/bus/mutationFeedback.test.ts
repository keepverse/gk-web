import { beforeEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { useToastStack } from "@/shell/toastStack";
import { createMutationFeedbackCache } from "./mutationFeedback";

function makeClient() {
  return new QueryClient({ mutationCache: createMutationFeedbackCache() });
}

beforeEach(() => {
  useToastStack.getState().clear();
});

describe("mutation feedback (T11) — one listener, every mutation with meta.entity", () => {
  it("a forced failure produces a band-4 toast naming the entity and stating nothing changed", async () => {
    const client = makeClient();
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ["test-fail"],
        meta: { entity: "Creature" },
        mutationFn: () => Promise.reject(new Error("500"))
      })
      .execute(undefined)
      .catch(() => {});

    const toasts = useToastStack.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe("bad");
    expect(toasts[0]!.title).toBe("Creature update failed");
    expect(toasts[0]!.message).toMatch(/nothing changed/i);
  });

  it("a forced failure on a different entity names that entity", async () => {
    const client = makeClient();
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ["test-fail-2"],
        meta: { entity: "Storage" },
        mutationFn: () => Promise.reject(new Error("500"))
      })
      .execute(undefined)
      .catch(() => {});

    expect(useToastStack.getState().toasts[0]!.title).toBe("Storage update failed");
  });

  it("a successful mutation produces a success toast", async () => {
    const client = makeClient();
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ["test-ok"],
        meta: { entity: "Cheat" },
        mutationFn: () => Promise.resolve({ ok: true })
      })
      .execute(undefined);

    const toasts = useToastStack.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe("ok");
    expect(toasts[0]!.title).toBe("Cheat updated");
  });

  it("meta.silent suppresses both success and failure toasts for that instance", async () => {
    const client = makeClient();
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ["test-silent-ok"],
        meta: { entity: "Board", silent: true },
        mutationFn: () => Promise.resolve({ ok: true })
      })
      .execute(undefined);
    expect(useToastStack.getState().toasts).toEqual([]);

    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ["test-silent-fail"],
        meta: { entity: "Board", silent: true },
        mutationFn: () => Promise.reject(new Error("500"))
      })
      .execute(undefined)
      .catch(() => {});
    expect(useToastStack.getState().toasts).toEqual([]);
  });

  it("a mutation with no meta.entity produces no toast rather than a broken one", async () => {
    const client = makeClient();
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ["test-no-meta"],
        mutationFn: () => Promise.resolve({ ok: true })
      })
      .execute(undefined);
    expect(useToastStack.getState().toasts).toEqual([]);
  });
});
