import { create } from "zustand";
import type { BulkOutcome } from "../logic/bulkMove";
import type { DealStage } from "../types/deal.types";

export type BulkKind = "move" | "retry" | "conflicts" | "undo";

export interface BulkRun {
  kind: BulkKind;
  targetLabel: string;
  status: "preparing" | "running" | "done";
  processed: number;
  total: number;
  skipped: number;
  cancelled: boolean;
  outcome: BulkOutcome | null;
}

export interface BulkConfirm {
  targetStage: DealStage;
  count: number;
}

interface BulkState {
  run: BulkRun | null;
  confirm: BulkConfirm | null;
  controller: AbortController | null;
  setRun: (run: BulkRun | null) => void;
  patchRun: (patch: Partial<BulkRun>) => void;
  setConfirm: (confirm: BulkConfirm | null) => void;
  setController: (controller: AbortController | null) => void;
}

export const useBulkStore = create<BulkState>()((set) => ({
  run: null,
  confirm: null,
  controller: null,
  setRun: (run) => set({ run }),
  patchRun: (patch) =>
    set((state) => (state.run ? { run: { ...state.run, ...patch } } : {})),
  setConfirm: (confirm) => set({ confirm }),
  setController: (controller) => set({ controller }),
}));
