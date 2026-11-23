import { create } from "zustand";
import type { DashboardData } from "../logic/dashboard";
import {
  EMPTY_SELECTION,
  syncSelectedDeal,
  type Selection,
} from "../logic/selection";
import type { Deal, DealScope, DealStage } from "../types/deal.types";

export type SaveStatus =
  | { kind: "saving"; targetStage: DealStage; token: number }
  | { kind: "bulk"; targetStage: DealStage }
  | { kind: "failed"; targetStage: DealStage; message: string; retryable: boolean }
  | {
      kind: "conflict";
      targetStage: DealStage;
      changedBy: string;
      theirStage: DealStage;
    };

export interface LiveMark {
  by: string;
  fromStage: DealStage;
  toStage: DealStage;
  at: number;
  fresh: boolean;
  matchesView: boolean;
}

export type DashboardStatus = "loading" | "ready" | "error";

export interface VisibleRange {
  first: number;
  last: number;
}

interface DealStoreState {
  dealsById: Record<string, Deal>;
  batches: Record<number, string[]>;
  visibleRange: VisibleRange;
  total: number;
  loadedAt: number;
  saves: Record<string, SaveStatus>;
  liveMarks: Record<string, LiveMark>;
  selection: Selection;
  dashboard: DashboardData | null;
  dashboardScope: DealScope;
  dashboardStatus: DashboardStatus;
  backgroundChanges: number;
  dataRevision: number;
  replaceRows: (firstBatch: Deal[], total: number, keepIds: readonly string[]) => void;
  addBatch: (batch: number, deals: Deal[], total: number) => void;
  dropBatches: (batchesToDrop: readonly number[], keepIds: readonly string[]) => void;
  setVisibleRange: (range: VisibleRange) => void;
  upsertDeals: (deals: readonly Deal[]) => void;
  noteDataChanged: () => void;
  setSave: (dealId: string, status: SaveStatus | null) => void;
  setSaves: (updates: Record<string, SaveStatus | null>) => void;
  markLive: (dealId: string, mark: LiveMark) => void;
  fadeLive: (dealId: string, at: number) => void;
  noteBackgroundChange: () => void;
  setSelection: (selection: Selection) => void;
  setDashboardLoading: (scope: DealScope) => void;
  setDashboard: (dashboard: DashboardData) => void;
  setDashboardError: () => void;
  patchDashboard: (update: (dashboard: DashboardData) => DashboardData) => void;
}

function pickNewer(existing: Deal | undefined, incoming: Deal): Deal {
  return existing && existing.version > incoming.version ? existing : incoming;
}

export const useDealStore = create<DealStoreState>()((set) => ({
  dealsById: {},
  batches: {},
  visibleRange: { first: 0, last: 0 },
  total: 0,
  loadedAt: Date.now(),
  saves: {},
  liveMarks: {},
  selection: EMPTY_SELECTION,
  dashboard: null,
  dashboardScope: "mine",
  dashboardStatus: "loading",
  backgroundChanges: 0,
  dataRevision: 0,

  replaceRows: (firstBatch, total, keepIds) =>
    set((state) => {
      const dealsById: Record<string, Deal> = {};
      const idsToKeep = [...keepIds, ...Object.keys(state.saves)];

      for (const id of idsToKeep) {
        const deal = state.dealsById[id];

        if (deal) {
          dealsById[id] = deal;
        }
      }

      for (const deal of firstBatch) {
        dealsById[deal.id] = pickNewer(dealsById[deal.id], deal);
      }

      return {
        dealsById,
        batches: { 0: firstBatch.map((deal) => deal.id) },
        total,
        loadedAt: Date.now(),
        liveMarks: {},
        backgroundChanges: 0,
      };
    }),

  addBatch: (batch, deals, total) =>
    set((state) => {
      const dealsById = { ...state.dealsById };

      for (const deal of deals) {
        dealsById[deal.id] = pickNewer(dealsById[deal.id], deal);
      }

      return {
        dealsById,
        batches: { ...state.batches, [batch]: deals.map((deal) => deal.id) },
        total,
      };
    }),

  dropBatches: (batchesToDrop, keepIds) =>
    set((state) => {
      if (batchesToDrop.length === 0) {
        return {};
      }

      const batches = { ...state.batches };
      const dealsById = { ...state.dealsById };
      const protectedIds = new Set([...keepIds, ...Object.keys(state.saves)]);

      for (const batch of batchesToDrop) {
        for (const id of batches[batch] ?? []) {
          if (!protectedIds.has(id)) {
            delete dealsById[id];
          }
        }

        delete batches[batch];
      }

      return { batches, dealsById };
    }),

  setVisibleRange: (range) =>
    set((state) =>
      state.visibleRange.first === range.first && state.visibleRange.last === range.last
        ? {}
        : { visibleRange: range }
    ),

  noteDataChanged: () =>
    set((state) => ({ dataRevision: state.dataRevision + 1 })),

  upsertDeals: (deals) =>
    set((state) => {
      let dealsById = state.dealsById;

      for (const deal of deals) {
        const existing = dealsById[deal.id];

        if (!existing || existing.version > deal.version) {
          continue;
        }

        if (dealsById === state.dealsById) {
          dealsById = { ...state.dealsById };
        }

        dealsById[deal.id] = deal;
      }

      return dealsById === state.dealsById
        ? {}
        : { dealsById, dataRevision: state.dataRevision + 1 };
    }),

  setSave: (dealId, status) =>
    set((state) => {
      const saves = { ...state.saves };

      if (status) {
        saves[dealId] = status;
      } else {
        delete saves[dealId];
      }

      return { saves };
    }),

  setSaves: (updates) =>
    set((state) => {
      const saves = { ...state.saves };

      for (const [dealId, status] of Object.entries(updates)) {
        if (status) {
          saves[dealId] = status;
        } else {
          delete saves[dealId];
        }
      }

      return { saves };
    }),

  markLive: (dealId, mark) =>
    set((state) => ({ liveMarks: { ...state.liveMarks, [dealId]: mark } })),

  fadeLive: (dealId, at) =>
    set((state) => {
      const mark = state.liveMarks[dealId];

      if (!mark || mark.at !== at) {
        return {};
      }

      return {
        liveMarks: { ...state.liveMarks, [dealId]: { ...mark, fresh: false } },
      };
    }),

  noteBackgroundChange: () =>
    set((state) => ({
      backgroundChanges: state.backgroundChanges + 1,
      dataRevision: state.dataRevision + 1,
    })),

  setSelection: (selection) => set({ selection }),

  setDashboardLoading: (scope) =>
    set((state) => ({
      dashboardScope: scope,
      dashboardStatus: "loading",
      dashboard: state.dashboardScope === scope ? state.dashboard : null,
    })),

  setDashboard: (dashboard) => set({ dashboard, dashboardStatus: "ready" }),

  setDashboardError: () => set({ dashboardStatus: "error" }),

  patchDashboard: (update) =>
    set((state) =>
      state.dashboard ? { dashboard: update(state.dashboard) } : {}
    ),
}));

export function syncSelectionWithOwnSave(deal: Deal): void {
  const { selection, setSelection } = useDealStore.getState();
  const next = syncSelectedDeal(selection, deal);

  if (next !== selection) {
    setSelection(next);
  }
}
