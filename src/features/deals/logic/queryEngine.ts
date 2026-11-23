import { DEAL_STAGES, type Deal, type DealQuery, type DealStage } from "../types/deal.types";
import {
  computeDealKeys,
  getDayBounds,
  queryDeals,
  type DealKeys,
  type DealKeysLookup,
} from "./dealQuery";

export interface QueryEngine {
  keysOf: DealKeysLookup;
  run: (query: DealQuery, currentUser: string, now: Date) => readonly Deal[];
  recordChange: (deal: Deal, previousStage: DealStage) => void;
  dataVersion: () => number;
  cacheSize: () => number;
}

interface CachedResult {
  dataVersion: number;
  result: readonly Deal[];
}

export function createQueryEngine(
  deals: readonly Deal[],
  dealsById: ReadonlyMap<string, Deal>,
  maxCachedQueries = 8
): QueryEngine {
  const keysById = new Map<string, DealKeys>();
  const idsByStage = new Map<DealStage, Set<string>>(
    DEAL_STAGES.map((stage) => [stage, new Set<string>()])
  );
  const cache = new Map<string, CachedResult>();
  let version = 0;

  for (const deal of deals) {
    keysById.set(deal.id, computeDealKeys(deal));
    idsByStage.get(deal.stage)!.add(deal.id);
  }

  const keysOf: DealKeysLookup = (deal) => {
    let keys = keysById.get(deal.id);

    if (!keys) {
      keys = computeDealKeys(deal);
      keysById.set(deal.id, keys);
    }

    return keys;
  };

  function getCandidates(stage: DealStage | null): readonly Deal[] {
    if (!stage) {
      return deals;
    }

    const candidates: Deal[] = [];

    for (const id of idsByStage.get(stage)!) {
      const deal = dealsById.get(id);

      if (deal) {
        candidates.push(deal);
      }
    }

    return candidates;
  }

  function buildCacheKey(query: DealQuery, currentUser: string, now: Date): string {
    return JSON.stringify([
      query.search.trim().toLowerCase(),
      query.stage,
      query.scope,
      query.quickFilter,
      query.sortKey,
      query.sortDirection,
      currentUser,
      getDayBounds(now).start,
    ]);
  }

  return {
    keysOf,

    run(query, currentUser, now) {
      const cacheKey = buildCacheKey(query, currentUser, now);
      const cached = cache.get(cacheKey);

      if (cached && cached.dataVersion === version) {
        cache.delete(cacheKey);
        cache.set(cacheKey, cached);
        return cached.result;
      }

      const result = queryDeals(
        getCandidates(query.stage),
        query,
        currentUser,
        now,
        keysOf
      );

      cache.delete(cacheKey);
      cache.set(cacheKey, { dataVersion: version, result });

      if (cache.size > maxCachedQueries) {
        cache.delete(cache.keys().next().value!);
      }

      return result;
    },

    recordChange(deal, previousStage) {
      keysById.set(deal.id, computeDealKeys(deal));

      if (previousStage !== deal.stage) {
        idsByStage.get(previousStage)!.delete(deal.id);
        idsByStage.get(deal.stage)!.add(deal.id);
      }

      version += 1;
    },

    dataVersion: () => version,

    cacheSize: () => cache.size,
  };
}
