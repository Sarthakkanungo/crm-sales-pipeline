import { useCallback, useEffect, useRef } from "react";
import { cancelBulkConfirm } from "../actions/bulkActions";
import type { SelectAllState } from "../components/DealsTable";
import { rowIdsBetween } from "../logic/rowBatches";
import {
  EMPTY_SELECTION,
  selectAllMatching,
  selectionCount,
  setDealsSelected,
  toggleDealSelected,
} from "../logic/selection";
import { useDealStore } from "../store/dealStore";
import type { Deal, DealQuery } from "../types/deal.types";

function getLoadedDeals(fromIndex: number, toIndex: number): Deal[] {
  const { batches, dealsById } = useDealStore.getState();

  return rowIdsBetween(batches, fromIndex, toIndex)
    .map((id) => dealsById[id])
    .filter((deal): deal is Deal => Boolean(deal));
}

export function useRowSelection(query: DealQuery, total: number, filterKey: string) {
  const anchorIndexRef = useRef<number | null>(null);

  const selectAllState = useDealStore((state): SelectAllState => {
    const { selection } = state;

    if (selection.mode === "query" && Object.keys(selection.excluded).length === 0) {
      return "all";
    }

    return selectionCount(selection) > 0 ? "some" : "none";
  });

  useEffect(() => {
    useDealStore.getState().setSelection(EMPTY_SELECTION);
    cancelBulkConfirm();
    anchorIndexRef.current = null;
  }, [filterKey]);

  const toggleSelect = useCallback((dealId: string, index: number, shiftKey: boolean) => {
    const store = useDealStore.getState();
    const anchor = anchorIndexRef.current;

    if (shiftKey && anchor !== null && anchor !== index) {
      const deals = getLoadedDeals(Math.min(anchor, index), Math.max(anchor, index));

      store.setSelection(setDealsSelected(store.selection, deals, true));
    } else {
      const deal = store.dealsById[dealId];

      if (deal) {
        store.setSelection(toggleDealSelected(store.selection, deal));
      }
    }

    anchorIndexRef.current = index;
  }, []);

  const selectRange = useCallback((fromIndex: number, toIndex: number) => {
    const store = useDealStore.getState();

    store.setSelection(setDealsSelected(store.selection, getLoadedDeals(fromIndex, toIndex), true));
  }, []);

  const toggleAll = useCallback(() => {
    useDealStore
      .getState()
      .setSelection(
        selectAllState === "all" ? EMPTY_SELECTION : selectAllMatching(query, total)
      );
  }, [selectAllState, query, total]);

  return { selectAllState, toggleSelect, selectRange, toggleAll };
}
