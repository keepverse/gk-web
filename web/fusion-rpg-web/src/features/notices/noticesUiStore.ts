import { create } from "zustand";
import type { NotifyCategoryId } from "@/shell/notify/catalog";

type NoticesUiState = {
  selectedCategory: NotifyCategoryId | null;
  selectCategory: (category: NotifyCategoryId) => void;
};

/**
 * notify-centre spec §2 step 5 / Strengthen pass S6-S7 — module-level, like `toastStack.ts`, NOT
 * component state: `PanelShell` is a Radix `Dialog` (`shell/PanelShell.tsx`) that unmounts its
 * content on close, so component state would reset the selection every time the centre is
 * reopened. GG-51 needs it to survive.
 */
export const useNoticesUiStore = create<NoticesUiState>((set) => ({
  selectedCategory: null,
  selectCategory: (category) => set({ selectedCategory: category })
}));

/** Test isolation — not for production. */
export function resetNoticesUiStoreForTests(): void {
  useNoticesUiStore.setState({ selectedCategory: null });
}
