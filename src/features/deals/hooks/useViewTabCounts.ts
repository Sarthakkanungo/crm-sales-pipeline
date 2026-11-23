import { useEffect, useState } from "react";
import type { ViewTabCounts } from "../logic/dashboard";
import { getViewTabCounts } from "../services/dealService";
import { useDealStore } from "../store/dealStore";
import type { DealQuery } from "../types/deal.types";

const REFRESH_DELAY_MS = 400;

export function useViewTabCounts(query: DealQuery): ViewTabCounts | null {
  const dataRevision = useDealStore((state) => state.dataRevision);
  const [counts, setCounts] = useState<ViewTabCounts | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const timeoutId = setTimeout(() => {
      getViewTabCounts(query)
        .then((result) => {
          if (isCurrent) {
            setCounts(result);
          }
        })
        .catch(() => undefined);
    }, REFRESH_DELAY_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timeoutId);
    };
  }, [query, dataRevision]);

  return counts;
}
