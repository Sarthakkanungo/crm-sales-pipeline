import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { BATCH_SIZE, batchesNeeded, batchesToDrop } from "../logic/rowBatches";
import { getDeals } from "../services/dealService";
import { useDealStore } from "../store/dealStore";
import type { DealQuery } from "../types/deal.types";

interface DealRowsState {
  isLoading: boolean;
  error: string;
  reload: () => void;
  ensureRange: (firstVisible: number, lastVisible: number) => void;
}

interface ListSession {
  key: string;
  query: DealQuery;
  snapshotId: string | null;
  inFlight: Set<number>;
}

interface Problem {
  key: string;
  message: string;
}

export function useDealRows(
  query: DealQuery,
  keepIdsRef: RefObject<string[]>
): DealRowsState {
  const [reloadToken, setReloadToken] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const requestKey = JSON.stringify([query, reloadToken]);
  const listRef = useRef<ListSession>({
    key: "",
    query,
    snapshotId: null,
    inFlight: new Set(),
  });

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const list: ListSession = {
      key: requestKey,
      query,
      snapshotId: null,
      inFlight: new Set([0]),
    };

    listRef.current = list;

    getDeals({ ...query, offset: 0, limit: BATCH_SIZE })
      .then((response) => {
        if (listRef.current !== list) {
          return;
        }

        list.snapshotId = response.snapshotId;
        list.inFlight.delete(0);
        useDealStore
          .getState()
          .replaceRows(response.data, response.total, keepIdsRef.current);
        setSettledKey(list.key);
      })
      .catch(() => {
        if (listRef.current === list) {
          list.inFlight.delete(0);
          setSettledKey(list.key);
          setProblem({ key: list.key, message: "Could not load deals." });
        }
      });
  }, [query, requestKey, keepIdsRef]);

  const ensureRange = useCallback(
    (firstVisible: number, lastVisible: number) => {
      const list = listRef.current;

      if (!list.snapshotId) {
        return;
      }

      const store = useDealStore.getState();

      for (const batch of batchesNeeded(firstVisible, lastVisible, store.total)) {
        if (store.batches[batch] || list.inFlight.has(batch)) {
          continue;
        }

        list.inFlight.add(batch);

        getDeals({
          ...list.query,
          offset: batch * BATCH_SIZE,
          limit: BATCH_SIZE,
          snapshotId: list.snapshotId,
        })
          .then((response) => {
            if (listRef.current !== list) {
              return;
            }

            list.inFlight.delete(batch);

            if (response.snapshotId !== list.snapshotId) {
              reload();
              return;
            }

            useDealStore.getState().addBatch(batch, response.data, response.total);
          })
          .catch(() => {
            list.inFlight.delete(batch);

            if (listRef.current === list) {
              setProblem({
                key: list.key,
                message: "Some rows could not be loaded.",
              });
            }
          });
      }

      const loaded = Object.keys(store.batches).map(Number);
      store.dropBatches(
        batchesToDrop(loaded, firstVisible, lastVisible),
        keepIdsRef.current
      );
    },
    [keepIdsRef, reload]
  );

  const isCurrentProblem = problem?.key === requestKey;

  return {
    isLoading: settledKey !== requestKey,
    error: isCurrentProblem ? problem.message : "",
    reload,
    ensureRange,
  };
}
