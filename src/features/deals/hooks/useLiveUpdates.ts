import { useEffect, type RefObject } from "react";
import { CURRENT_USER } from "../../../config/currentUser";
import { recordStageChangeInDashboard } from "../actions/dealActions";
import { createDealMatcher } from "../logic/dealQuery";
import {
  startTeammateSimulation,
  subscribeToDealChanges,
} from "../services/dealService";
import { useDealStore } from "../store/dealStore";
import type { DealQuery } from "../types/deal.types";

const HIGHLIGHT_MS = 4000;

export function useLiveUpdates(queryRef: RefObject<DealQuery>): void {
  useEffect(() => startTeammateSimulation(), []);

  useEffect(
    () =>
      subscribeToDealChanges(({ deal, previousStage }) => {
        recordStageChangeInDashboard(deal, previousStage, deal.stage);

        const store = useDealStore.getState();
        const matches = createDealMatcher(queryRef.current, CURRENT_USER, new Date());
        const matchesView = matches(deal);

        if (!(deal.id in store.dealsById)) {
          const affectsView = matchesView || matches({ ...deal, stage: previousStage });

          if (affectsView) {
            store.noteBackgroundChange();
          } else {
            store.noteDataChanged();
          }
          return;
        }

        const at = Date.now();

        store.upsertDeals([deal]);
        store.markLive(deal.id, {
          by: deal.updatedBy,
          fromStage: previousStage,
          toStage: deal.stage,
          at,
          fresh: true,
          matchesView,
        });

        setTimeout(
          () => useDealStore.getState().fadeLive(deal.id, at),
          HIGHLIGHT_MS
        );
      }),
    [queryRef]
  );
}
