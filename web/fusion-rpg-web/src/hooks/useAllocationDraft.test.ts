import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAllocationDraft } from "./useAllocationDraft";

describe("useAllocationDraft", () => {
  it("stays null until the server values arrive", () => {
    const { result } = renderHook(() =>
      useAllocationDraft({ serverValues: undefined, budget: 100, isSaving: false, onSave: vi.fn() })
    );
    expect(result.current.draft).toBeNull();
  });

  it("seeds the draft from the server values once they arrive, and never re-seeds over an edit", () => {
    const { result, rerender } = renderHook(
      (props: { serverValues: Record<string, number> | undefined }) =>
        useAllocationDraft({ ...props, budget: 100, isSaving: false, onSave: vi.fn() }),
      { initialProps: { serverValues: undefined as Record<string, number> | undefined } }
    );
    expect(result.current.draft).toBeNull();

    rerender({ serverValues: { Might: 5 } });
    expect(result.current.draft).toEqual({ Might: 5 });

    act(() => result.current.setValue("Might", 9));
    expect(result.current.draft).toEqual({ Might: 9 });

    // A later server refetch of the SAME data must never clobber the player's unsaved edit.
    rerender({ serverValues: { Might: 5 } });
    expect(result.current.draft).toEqual({ Might: 9 });
  });

  it("sums spent from the draft and never clamps an over-budget value (PS-8)", () => {
    const { result } = renderHook(() =>
      useAllocationDraft({ serverValues: { Might: 0 }, budget: 10, isSaving: false, onSave: vi.fn() })
    );

    act(() => result.current.setValue("Might", 15));
    expect(result.current.draft?.Might).toBe(15); // typed value preserved, not truncated to budget
    expect(result.current.spent).toBe(15);
    expect(result.current.withinBudget).toBe(false);
  });

  it("setValue clamps to a non-negative whole number, independent of budget", () => {
    const { result } = renderHook(() =>
      useAllocationDraft({ serverValues: { Might: 0 }, budget: 100, isSaving: false, onSave: vi.fn() })
    );

    act(() => result.current.setValue("Might", -3.7));
    expect(result.current.draft?.Might).toBe(0);

    act(() => result.current.setValue("Might", 4.9));
    expect(result.current.draft?.Might).toBe(4);
  });

  it("dirty compares against the server's own values, not the draft's edit history", () => {
    const { result } = renderHook(() =>
      useAllocationDraft({ serverValues: { Might: 5 }, budget: 100, isSaving: false, onSave: vi.fn() })
    );
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setValue("Might", 6));
    expect(result.current.dirty).toBe(true);

    act(() => result.current.setValue("Might", 5));
    expect(result.current.dirty).toBe(false);
  });

  it("revert discards an unsaved edit back to the server's last-known values", () => {
    const { result } = renderHook(() =>
      useAllocationDraft({ serverValues: { Might: 5 }, budget: 100, isSaving: false, onSave: vi.fn() })
    );

    act(() => result.current.setValue("Might", 40));
    expect(result.current.dirty).toBe(true);

    act(() => result.current.revert());
    expect(result.current.draft).toEqual({ Might: 5 });
    expect(result.current.dirty).toBe(false);
  });

  it("save calls onSave with the current whole draft, never a per-id call", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAllocationDraft({ serverValues: { Might: 5, Fortitude: 2 }, budget: 100, isSaving: false, onSave })
    );

    act(() => result.current.setValue("Might", 9));
    await act(async () => {
      await result.current.save();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ Might: 9, Fortitude: 2 });
  });

  it("a thrown save surfaces as error rather than escaping uncaught", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useAllocationDraft({ serverValues: { Might: 5 }, budget: 100, isSaving: false, onSave })
    );

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.error).toBe("boom");
  });

  describe("I8: initialValues seeds the draft, dirty/revert stay keyed on serverValues", () => {
    it("seeds from initialValues when given, not from serverValues", () => {
      const { result } = renderHook(() =>
        useAllocationDraft({
          serverValues: { Might: 5 },
          initialValues: { Might: 9 }, // a lifted Plan's own pending edit
          budget: 100,
          isSaving: false,
          onSave: vi.fn()
        })
      );
      expect(result.current.draft).toEqual({ Might: 9 });
    });

    it("a value seeded from initialValues still reads dirty against the TRUE server value", () => {
      const { result } = renderHook(() =>
        useAllocationDraft({
          serverValues: { Might: 5 },
          initialValues: { Might: 9 },
          budget: 100,
          isSaving: false,
          onSave: vi.fn()
        })
      );
      // The seeded value differs from the committed server value -- this is exactly "a pending Plan
      // edit that survived reopening," and it must never be mistaken for already-committed.
      expect(result.current.dirty).toBe(true);
    });

    it("revert restores serverValues, never initialValues -- reverting discards the WHOLE pending edit", () => {
      const { result } = renderHook(() =>
        useAllocationDraft({
          serverValues: { Might: 5 },
          initialValues: { Might: 9 },
          budget: 100,
          isSaving: false,
          onSave: vi.fn()
        })
      );
      act(() => result.current.revert());
      expect(result.current.draft).toEqual({ Might: 5 });
      expect(result.current.dirty).toBe(false);
    });

    it("omitting initialValues reproduces I7's exact behaviour -- seeds from serverValues", () => {
      const { result } = renderHook(() =>
        useAllocationDraft({ serverValues: { Might: 5 }, budget: 100, isSaving: false, onSave: vi.fn() })
      );
      expect(result.current.draft).toEqual({ Might: 5 });
      expect(result.current.dirty).toBe(false);
    });
  });

  it("save is a no-op while a save is already in flight", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAllocationDraft({ serverValues: { Might: 5 }, budget: 100, isSaving: true, onSave })
    );

    await act(async () => {
      await result.current.save();
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});
