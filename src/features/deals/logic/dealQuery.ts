import type {
  Deal,
  DealQuery,
  DealStage,
  QuickFilter,
  SortDirection,
  SortKey,
} from "../types/deal.types";

export type FollowUpBucket = "overdue" | "dueToday" | "upcoming" | "none";

export interface DealKeys {
  idNumber: number;
  updatedAt: number;
  nextFollowUpAt: number | null;
  closeDate: number | null;
  nameLower: string;
  companyLower: string;
}

export type DealKeysLookup = (deal: Deal) => DealKeys;

export function isOpenStage(stage: DealStage): boolean {
  return stage !== "Won" && stage !== "Lost";
}

const OPEN_ONLY_VIEWS: readonly QuickFilter[] = ["active", "overdue", "dueToday"];

export function resolveFilterConflict<T extends Pick<DealQuery, "stage" | "quickFilter">>(
  filters: T,
  changed: "stage" | "quickFilter"
): T {
  const isImpossible =
    filters.stage !== null &&
    !isOpenStage(filters.stage) &&
    filters.quickFilter !== null &&
    OPEN_ONLY_VIEWS.includes(filters.quickFilter);

  if (!isImpossible) {
    return filters;
  }

  return changed === "stage"
    ? { ...filters, quickFilter: null }
    : { ...filters, stage: null };
}

function getIdNumber(id: string): number {
  const number = Number(id.slice(id.lastIndexOf("-") + 1));

  return Number.isFinite(number) ? number : 0;
}

export function computeDealKeys(deal: Deal): DealKeys {
  return {
    idNumber: getIdNumber(deal.id),
    updatedAt: Date.parse(deal.updatedAt),
    nextFollowUpAt: deal.nextFollowUpAt ? Date.parse(deal.nextFollowUpAt) : null,
    closeDate: deal.closeDate ? Date.parse(deal.closeDate) : null,
    nameLower: deal.name.toLowerCase(),
    companyLower: deal.companyName.toLowerCase(),
  };
}

export function getDayBounds(now: Date): { start: number; end: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start: start.getTime(), end: end.getTime() };
}

export function classifyFollowUpTime(
  time: number | null,
  bounds: { start: number; end: number }
): FollowUpBucket {
  if (time === null) {
    return "none";
  }

  if (time < bounds.start) {
    return "overdue";
  }

  if (time < bounds.end) {
    return "dueToday";
  }

  return "upcoming";
}

export function getFollowUpTiming(
  nextFollowUpAt: string | null,
  now: Date
): FollowUpBucket {
  return classifyFollowUpTime(
    nextFollowUpAt ? Date.parse(nextFollowUpAt) : null,
    getDayBounds(now)
  );
}

export function getFollowUpBucket(
  deal: Pick<Deal, "stage" | "nextFollowUpAt">,
  now: Date
): FollowUpBucket {
  return isOpenStage(deal.stage)
    ? getFollowUpTiming(deal.nextFollowUpAt, now)
    : "none";
}

export function createDealMatcher(
  query: DealQuery,
  currentUser: string,
  now: Date,
  getKeys: DealKeysLookup = computeDealKeys
): (deal: Deal) => boolean {
  const search = query.search.trim().toLowerCase();
  const { start, end } = getDayBounds(now);

  return (deal) => {
    if (query.scope === "mine" && deal.ownerName !== currentUser) {
      return false;
    }

    if (query.stage && deal.stage !== query.stage) {
      return false;
    }

    if (search) {
      const keys = getKeys(deal);

      const isIdMatch = deal.id.toLowerCase() === search;

      if (!isIdMatch && !keys.nameLower.includes(search) && !keys.companyLower.includes(search)) {
        return false;
      }
    }

    if (query.quickFilter === "active") {
      return isOpenStage(deal.stage);
    }

    if (query.quickFilter === "updatedToday") {
      const updated = getKeys(deal).updatedAt;
      return updated >= start && updated < end;
    }

    if (query.quickFilter === "overdue" || query.quickFilter === "dueToday") {
      if (!isOpenStage(deal.stage)) {
        return false;
      }

      const time = getKeys(deal).nextFollowUpAt;

      if (time === null) {
        return false;
      }

      return query.quickFilter === "overdue"
        ? time < start
        : time >= start && time < end;
    }

    return true;
  };
}

function getSortValue(deal: Deal, keys: DealKeys, key: SortKey): number | null {
  switch (key) {
    case "value":
      return deal.value;
    case "closeDate":
      return keys.closeDate;
    case "nextFollowUpAt":
      return keys.nextFollowUpAt;
    case "updatedAt":
      return keys.updatedAt;
  }
}

export function sortDeals(
  deals: readonly Deal[],
  key: SortKey,
  direction: SortDirection,
  getKeys: DealKeysLookup = computeDealKeys
): Deal[] {
  const decorated = deals.map((deal) => {
    const keys = getKeys(deal);

    return {
      deal,
      value: getSortValue(deal, keys, key),
      idNumber: keys.idNumber,
    };
  });

  const sign = direction === "asc" ? 1 : -1;

  decorated.sort((a, b) => {
    if (a.value === null && b.value !== null) {
      return 1;
    }

    if (b.value === null && a.value !== null) {
      return -1;
    }

    if (a.value !== null && b.value !== null && a.value !== b.value) {
      return (a.value - b.value) * sign;
    }

    return a.idNumber - b.idNumber;
  });

  return decorated.map((item) => item.deal);
}

export function queryDeals(
  deals: readonly Deal[],
  query: DealQuery,
  currentUser: string,
  now: Date,
  getKeys: DealKeysLookup = computeDealKeys
): Deal[] {
  const matches = deals.filter(
    createDealMatcher(query, currentUser, now, getKeys)
  );

  return sortDeals(matches, query.sortKey, query.sortDirection, getKeys);
}
