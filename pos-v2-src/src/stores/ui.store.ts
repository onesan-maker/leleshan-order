import { create } from "zustand";

export type ToastType = "ok" | "err" | "info";

interface UIState {
  toast: { message: string; type: ToastType; visible: boolean };
  showToast(message: string, type?: ToastType): void;
  hideToast(): void;
}

let hideTimer: number | null = null;

export const useUIStore = create<UIState>((set) => ({
  toast: { message: "", type: "info", visible: false },

  showToast: (message, type = "info") => {
    if (hideTimer) window.clearTimeout(hideTimer);
    set({ toast: { message, type, visible: true } });
    hideTimer = window.setTimeout(() => {
      set((s) => ({ toast: { ...s.toast, visible: false } }));
    }, 3000);
  },

  hideToast: () => {
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
    set((s) => ({ toast: { ...s.toast, visible: false } }));
  },
}));
