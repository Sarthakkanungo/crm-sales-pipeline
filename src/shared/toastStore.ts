import { create } from "zustand";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  key?: string;
  tone: ToastTone;
  message: string;
  actions: ToastAction[];
  sticky: boolean;
}

export interface UndoEntry {
  label: string;
  run: () => void;
}

interface ToastState {
  toasts: Toast[];
  lastUndo: UndoEntry | null;
  push: (toast: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
  dismissKey: (key: string) => void;
  setLastUndo: (entry: UndoEntry | null) => void;
}

const AUTO_DISMISS_MS = 6000;
const MAX_TOASTS = 5;
let nextToastId = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  lastUndo: null,

  push: (input) => {
    nextToastId += 1;
    const toast: Toast = { ...input, id: nextToastId };

    set((state) => {
      const others = input.key
        ? state.toasts.filter((item) => item.key !== input.key)
        : state.toasts;

      return { toasts: [...others, toast].slice(-MAX_TOASTS) };
    });

    if (!toast.sticky) {
      setTimeout(() => get().dismiss(toast.id), AUTO_DISMISS_MS);
    }

    return toast.id;
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  dismissKey: (key) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.key !== key) })),

  setLastUndo: (entry) => set({ lastUndo: entry }),
}));

export function showToast(toast: Omit<Toast, "id">): number {
  return useToastStore.getState().push(toast);
}

export function runLastUndo(): boolean {
  const { lastUndo, setLastUndo } = useToastStore.getState();

  if (!lastUndo) {
    return false;
  }

  setLastUndo(null);
  lastUndo.run();

  return true;
}
