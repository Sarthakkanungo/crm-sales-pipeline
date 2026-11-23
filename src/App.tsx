import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allowedScope, getPermissions, ROLE_LABELS } from "./features/session/permissions";
import { sessionStore, useSession } from "./features/session/sessionStore";
import { cancelBulkConfirm, requestBulkMove } from "./features/deals/actions/bulkActions";
import { loadDashboard, moveDeal } from "./features/deals/actions/dealActions";
import { BulkBar } from "./features/deals/components/BulkBar";
import { DashboardPanel } from "./features/deals/components/DashboardPanel";
import { ViewTabs } from "./features/deals/components/ViewTabs";
import { DealDrawer } from "./features/deals/components/DealDrawer";
import {
  DealsTable,
  type DealsTableHandle,
  type SelectAllState,
} from "./features/deals/components/DealsTable";
import { DealsToolbar } from "./features/deals/components/DealsToolbar";
import { SimulationPanel, SimulationSummary } from "./features/deals/components/SimulationPanel";
import { useDealRows } from "./features/deals/hooks/useDealRows";
import { useViewTabCounts } from "./features/deals/hooks/useViewTabCounts";
import { useLiveUpdates } from "./features/deals/hooks/useLiveUpdates";
import { rowIdAt, rowIdsBetween } from "./features/deals/logic/rowBatches";
import {
  EMPTY_SELECTION,
  selectAllMatching,
  selectionCount,
  setDealsSelected,
  toggleDealSelected,
} from "./features/deals/logic/selection";
import { useBulkStore } from "./features/deals/store/bulkStore";
import { useDealStore } from "./features/deals/store/dealStore";
import {
  DEAL_STAGES,
  type Deal,
  type DealQuery,
  type DealStage,
  type QuickFilter,
  type SortDirection,
  type SortKey,
} from "./features/deals/types/deal.types";
import { resolveFilterConflict } from "./features/deals/logic/dealQuery";
import { isTypingTarget } from "./shared/focus";
import { formatCount, getInitials } from "./shared/format";
import { ShortcutHelp } from "./shared/ShortcutHelp";
import { Toasts } from "./shared/Toasts";
import { runLastUndo } from "./shared/toastStore";
import { useDebouncedValue } from "./shared/useDebouncedValue";

import "./App.css";

type Filters = Omit<DealQuery, "search">;

const DEFAULT_FILTERS: Filters = {
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

function getLoadedDeals(fromIndex: number, toIndex: number): Deal[] {
  const { batches, dealsById } = useDealStore.getState();

  return rowIdsBetween(batches, fromIndex, toIndex)
    .map((id) => dealsById[id])
    .filter((deal): deal is Deal => Boolean(deal));
}

function App() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const session = useSession();
  const permissions = getPermissions(session);
  const scope = allowedScope(session, filters.scope);
  const query = useMemo<DealQuery>(
    () => ({ ...filters, scope, search }),
    [filters, scope, search]
  );

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [drawer, setDrawer] = useState<{ dealId: string; openedAt: number } | null>(
    null
  );
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSimOpen, setIsSimOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<DealsTableHandle>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const anchorIndexRef = useRef<number | null>(null);
  const keepIdsRef = useRef<string[]>([]);
  const queryRef = useRef<DealQuery>(query);

  const filterKey = `${search}|${filters.stage}|${scope}|${filters.quickFilter}|${session.role}`;

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    keepIdsRef.current = drawer ? [drawer.dealId] : [];
  }, [drawer]);

  useEffect(() => {
    useDealStore.getState().setSelection(EMPTY_SELECTION);
    cancelBulkConfirm();
    anchorIndexRef.current = null;
  }, [filterKey]);

  useEffect(() => {
    void loadDashboard(scope);
  }, [scope, session.role]);

  useEffect(
    () =>
      sessionStore.subscribe((next, previous) => {
        if (next.role !== previous.role) {
          setDrawer(null);
        }
      }),
    []
  );

  const { isLoading, error, reload, ensureRange } = useDealRows(query, keepIdsRef);
  useLiveUpdates(queryRef);

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
  const tabCounts = useViewTabCounts(countsQuery);

  const total = useDealStore((state) => state.total);
  const loadedAt = useDealStore((state) => state.loadedAt);
  const backgroundChanges = useDealStore((state) => state.backgroundChanges);
  const staleRows = useDealStore(
    (state) =>
      Object.values(state.liveMarks).filter((mark) => !mark.matchesView).length
  );
  const selectAllState = useDealStore((state): SelectAllState => {
    const { selection } = state;

    if (selection.mode === "query" && Object.keys(selection.excluded).length === 0) {
      return "all";
    }

    return selectionCount(selection) > 0 ? "some" : "none";
  });

  const now = useMemo(() => new Date(loadedAt), [loadedAt]);
  const activeIndex = Math.min(focusedIndex, Math.max(0, total - 1));
  const hasFilters = Boolean(searchInput || filters.stage || filters.quickFilter);

  const handleRangeChange = useCallback(
    (firstVisible: number, lastVisible: number) => {
      ensureRange(firstVisible, lastVisible);
      useDealStore.getState().setVisibleRange({ first: firstVisible, last: lastVisible });
    },
    [ensureRange]
  );

  function updateFilters(patch: Partial<Filters>): void {
    const changed = "quickFilter" in patch ? "quickFilter" : "stage";

    setFilters((current) => resolveFilterConflict({ ...current, ...patch }, changed));
    setFocusedIndex(0);
  }

  function handleSort(key: SortKey): void {
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
  }

  function clearFilters(): void {
    setSearchInput("");
    updateFilters({ stage: null, quickFilter: null });
  }

  const openDeal = useCallback((dealId: string, index?: number) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (index !== undefined) {
      setFocusedIndex(index);
    }

    setIsSimOpen(false);
    setDrawer({ dealId, openedAt: Date.now() });
  }, []);

  function selectView(quickFilter: QuickFilter | null): void {
    const needsPriorityOrder = quickFilter === "overdue" || quickFilter === "dueToday";

    updateFilters(
      needsPriorityOrder
        ? { quickFilter, sortKey: "nextFollowUpAt", sortDirection: "asc" }
        : { quickFilter }
    );
  }

  function closeDrawer(): void {
    setDrawer(null);

    const returnTo = returnFocusRef.current;

    requestAnimationFrame(() => {
      if (returnTo?.isConnected) {
        returnTo.focus();
      } else {
        tableRef.current?.focusActiveRow();
      }
    });
  }

  const toggleSelect = useCallback(
    (dealId: string, index: number, shiftKey: boolean) => {
      const store = useDealStore.getState();
      const anchor = anchorIndexRef.current;

      if (shiftKey && anchor !== null && anchor !== index) {
        const from = Math.min(anchor, index);
        const to = Math.max(anchor, index);
        const deals = getLoadedDeals(from, to);

        store.setSelection(setDealsSelected(store.selection, deals, true));
      } else {
        const deal = store.dealsById[dealId];

        if (deal) {
          store.setSelection(toggleDealSelected(store.selection, deal));
        }
      }

      anchorIndexRef.current = index;
    },
    []
  );

  const selectRange = useCallback((fromIndex: number, toIndex: number) => {
    const store = useDealStore.getState();
    const deals = getLoadedDeals(fromIndex, toIndex);

    store.setSelection(setDealsSelected(store.selection, deals, true));
  }, []);

  function toggleAll(): void {
    useDealStore
      .getState()
      .setSelection(
        selectAllState === "all" ? EMPTY_SELECTION : selectAllMatching(query, total)
      );
  }

  const handleStageKey = useCallback(
    (stage: DealStage) => {
      const store = useDealStore.getState();

      if (selectionCount(store.selection) > 0) {
        requestBulkMove(stage);
        return;
      }

      const dealId = rowIdAt(store.batches, activeIndex);

      if (dealId) {
        void moveDeal(dealId, stage);
      }
    },
    [activeIndex]
  );

  useEffect(() => {
    if (drawer || isHelpOpen) {
      return;
    }

    function handleGlobalKeyDown(event: KeyboardEvent): void {
      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z";

      if (isUndo) {
        if (!isTypingTarget(event.target) && runLastUndo()) {
          event.preventDefault();
        }
        return;
      }

      if (
        isTypingTarget(event.target) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "?") {
        event.preventDefault();
        setIsHelpOpen(true);
      } else if (event.key === "Escape") {
        if (useBulkStore.getState().confirm) {
          cancelBulkConfirm();
        } else {
          useDealStore.getState().setSelection(EMPTY_SELECTION);
        }
      } else if (
        (event.key === "PageDown" || event.key === "PageUp") &&
        !event.defaultPrevented
      ) {
        event.preventDefault();
        tableRef.current?.moveByScreen(event.key === "PageDown" ? 1 : -1);
      } else if (
        !event.defaultPrevented &&
        selectionCount(useDealStore.getState().selection) > 0
      ) {
        const stage = DEAL_STAGES[Number(event.key) - 1];

        if (stage) {
          event.preventDefault();
          requestBulkMove(stage);
        }
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown);

    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [drawer, isHelpOpen]);

  const pendingTeammateChanges = backgroundChanges + staleRows;

  return (
    <main className={drawer ? "app drawer-open" : "app"}>
      <header className="top-header">
        <div className="brand">
          <div className="brand-logo">S</div>
          <div>
            <h1>Sales Pipeline</h1>
            <span>{permissions.canViewTeam ? "Team pipeline" : "My pipeline"}</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="sim-toggle"
            aria-expanded={isSimOpen}
            onClick={() => setIsSimOpen((open) => !open)}
          >
            Simulator <SimulationSummary />
          </button>

          <button
            type="button"
            className="shortcut-button"
            onClick={() => setIsHelpOpen(true)}
          >
            Keyboard shortcuts <kbd>?</kbd>
          </button>

          <div className="user-profile">
            <div className="user-avatar">{getInitials(session.userName)}</div>
            <div className="user-info">
              <strong>{session.userName}</strong>
              <span>{ROLE_LABELS[session.role]}</span>
            </div>
          </div>
        </div>
      </header>

      {isSimOpen && <SimulationPanel onClose={() => setIsSimOpen(false)} />}

      <DashboardPanel
        activeStage={filters.stage}
        activeQuickFilter={filters.quickFilter}
        onStageFilter={(stage) => updateFilters({ stage })}
        onQuickFilter={selectView}
        onRetry={() => void loadDashboard(scope)}
      />

      <section className="content-section deals-section" aria-labelledby="deals-heading">
        <h2 id="deals-heading" className="visually-hidden">
          Deals, {formatCount(total)} in this view
        </h2>

        <div className="deals-controls">
          <ViewTabs
            active={filters.quickFilter}
            counts={tabCounts}
            sortedByPriority={
              filters.sortKey === "nextFollowUpAt" && filters.sortDirection === "asc"
            }
            onChange={selectView}
          />

          <DealsToolbar
            searchRef={searchRef}
            searchInput={searchInput}
            stage={filters.stage}
            scope={scope}
            canViewTeam={permissions.canViewTeam}
            hasFilters={hasFilters}
            onSearchChange={setSearchInput}
            onStageChange={(stage) => updateFilters({ stage })}
            onScopeChange={(scope) => updateFilters({ scope })}
            onClearFilters={clearFilters}
          />
        </div>

        {error && (
          <p role="alert" className="error-message">
            {error}{" "}
            <button type="button" className="link-button" onClick={reload}>
              Retry
            </button>
          </p>
        )}

        {pendingTeammateChanges > 0 && (
          <div className="live-pill" role="status">
            Teammates changed {formatCount(pendingTeammateChanges)} deal
            {pendingTeammateChanges === 1 ? "" : "s"} that affect this view. Rows stay
            where they are until you refresh.
            <button type="button" className="link-button" onClick={reload}>
              Refresh view
            </button>
          </div>
        )}

        <BulkBar />

        <DealsTable
          ref={tableRef}
          total={total}
          listKey={loadedAt}
          focusedIndex={activeIndex}
          isLoading={isLoading}
          now={now}
          sortKey={filters.sortKey}
          sortDirection={filters.sortDirection}
          selectAllState={selectAllState}
          showOwner={scope === "all"}
          emptyState={
            <>
              No deals match this view.{" "}
              {hasFilters && (
                <button type="button" className="link-button" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </>
          }
          onSort={handleSort}
          onFocusedIndexChange={setFocusedIndex}
          onOpen={openDeal}
          onToggleSelect={toggleSelect}
          onSelectRange={selectRange}
          onToggleAll={toggleAll}
          onStageKey={handleStageKey}
          onRangeChange={handleRangeChange}
        />
      </section>

      {drawer && (
        <DealDrawer
          key={drawer.dealId}
          dealId={drawer.dealId}
          openedAt={drawer.openedAt}
          onClose={closeDrawer}
        />
      )}

      {isHelpOpen && <ShortcutHelp onClose={() => setIsHelpOpen(false)} />}

      <Toasts />
    </main>
  );
}

export default App;
