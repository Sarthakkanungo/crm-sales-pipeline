import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "../../../shared/useDebouncedValue";
import { allowedScope, type Role } from "../../session/permissions";
import { sessionStore, useSession } from "../../session/sessionStore";
import { resolveFilterConflict } from "../logic/dealQuery";
import {
  VIEW_ORDER,
  type DealQuery,
  type DealScope,
  type DealStage,
  type QuickFilter,
  type SortDirection,
  type SortKey,
} from "../types/deal.types";

type DealFilters = Omit<DealQuery, "search">;

const DEFAULT_FILTERS: DealFilters = {
  stage: null,
  scope: "mine",
  quickFilter: null,
  sortKey: "nextFollowUpAt",
  sortDirection: "asc",
};

const DEFAULT_SORT_DIRECTION: Record<SortKey, SortDirection> = {
  nextFollowUpAt: "asc",
  closeDate: "asc",
  value: "desc",
  updatedAt: "desc",
};

function defaultScopeFor(role: Role): DealScope {
  return role === "manager" ? "all" : "mine";
}

function viewPatch(quickFilter: QuickFilter | null): Partial<DealFilters> {
  return quickFilter === "overdue" || quickFilter === "dueToday"
    ? { quickFilter, sortKey: "nextFollowUpAt", sortDirection: "asc" }
    : { quickFilter };
}

export function useDealFilters(onFiltersChange: () => void) {
  const session = useSession();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [filters, setFilters] = useState<DealFilters>(() => ({
    ...DEFAULT_FILTERS,
    scope: defaultScopeFor(sessionStore.getState().role),
  }));
  const scope = allowedScope(session, filters.scope);

  const query = useMemo<DealQuery>(
    () => ({ ...filters, scope, search }),
    [filters, scope, search]
  );

  const countsQuery = useMemo<DealQuery>(
    () => ({
      search,
      stage: filters.stage,
      scope,
      quickFilter: null,
      sortKey: filters.sortKey,
      sortDirection: filters.sortDirection,
    }),
    [search, filters.stage, scope, filters.sortKey, filters.sortDirection]
  );

  const filterKey = `${search}|${filters.stage}|${scope}|${filters.quickFilter}|${session.role}`;
  const hasFilters = Boolean(searchInput || filters.stage || filters.quickFilter);

  const update = useCallback(
    (change: (current: DealFilters) => Partial<DealFilters>) => {
      setFilters((current) => {
        const patch = change(current);
        const changed = "quickFilter" in patch ? "quickFilter" : "stage";

        return resolveFilterConflict({ ...current, ...patch }, changed);
      });
      onFiltersChange();
    },
    [onFiltersChange]
  );

  useEffect(
    () =>
      sessionStore.subscribe((next, previous) => {
        if (next.role !== previous.role) {
          setFilters((current) => ({ ...current, scope: defaultScopeFor(next.role) }));
          onFiltersChange();
        }
      }),
    [onFiltersChange]
  );

  const setStage = useCallback(
    (stage: DealStage | null) => update(() => ({ stage })),
    [update]
  );

  const toggleStage = useCallback(
    (stage: DealStage | null) =>
      update((current) => ({ stage: stage === current.stage ? null : stage })),
    [update]
  );

  const setScope = useCallback((scope: DealScope) => update(() => ({ scope })), [update]);

  const selectView = useCallback(
    (quickFilter: QuickFilter | null) => update(() => viewPatch(quickFilter)),
    [update]
  );

  const stepView = useCallback(
    (step: 1 | -1) =>
      update((current) => {
        const index = VIEW_ORDER.indexOf(current.quickFilter);
        const next = VIEW_ORDER[(index + step + VIEW_ORDER.length) % VIEW_ORDER.length];

        return viewPatch(next);
      }),
    [update]
  );

  const sortBy = useCallback((key: SortKey) => {
    setFilters((current) => ({
      ...current,
      sortKey: key,
      sortDirection:
        current.sortKey === key
          ? current.sortDirection === "asc"
            ? "desc"
            : "asc"
          : DEFAULT_SORT_DIRECTION[key],
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    update(() => ({ stage: null, quickFilter: null }));
  }, [update]);

  return {
    searchInput,
    setSearchInput,
    filters,
    scope,
    query,
    countsQuery,
    filterKey,
    hasFilters,
    setStage,
    toggleStage,
    setScope,
    selectView,
    stepView,
    sortBy,
    clearFilters,
  };
}
