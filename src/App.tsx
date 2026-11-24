import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "./AppHeader";
import { getPermissions } from "./features/session/permissions";
import { useSession } from "./features/session/sessionStore";
import { requestBulkMove } from "./features/deals/actions/bulkActions";
import { loadDashboard, moveDeal } from "./features/deals/actions/dealActions";
import { BulkBar } from "./features/deals/components/BulkBar";
import { DashboardPanel } from "./features/deals/components/DashboardPanel";
import { DealDrawer } from "./features/deals/components/DealDrawer";
import { DealsTable, type DealsTableHandle } from "./features/deals/components/DealsTable";
import { DealsToolbar } from "./features/deals/components/DealsToolbar";
import { LiveChangesPill } from "./features/deals/components/LiveChangesPill";
import { SimulationPanel } from "./features/deals/components/SimulationPanel";
import { ViewTabs } from "./features/deals/components/ViewTabs";
import { useDealDrawer } from "./features/deals/hooks/useDealDrawer";
import { useDealFilters } from "./features/deals/hooks/useDealFilters";
import { useDealRows } from "./features/deals/hooks/useDealRows";
import { useGlobalShortcuts } from "./features/deals/hooks/useGlobalShortcuts";
import { useLiveUpdates } from "./features/deals/hooks/useLiveUpdates";
import { useOverviewToggle } from "./features/deals/hooks/useOverviewToggle";
import { useRowSelection } from "./features/deals/hooks/useRowSelection";
import { useViewTabCounts } from "./features/deals/hooks/useViewTabCounts";
import { rowIdAt } from "./features/deals/logic/rowBatches";
import { selectionCount } from "./features/deals/logic/selection";
import { useDealStore } from "./features/deals/store/dealStore";
import type { DealStage } from "./features/deals/types/deal.types";
import { formatCount } from "./shared/format";
import { ShortcutHelp } from "./shared/ShortcutHelp";
import { Toasts } from "./shared/Toasts";

import "./App.css";

function App() {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSimOpen, setIsSimOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<DealsTableHandle>(null);

  const session = useSession();
  const permissions = getPermissions(session);
  const resetFocus = useCallback(() => setFocusedIndex(0), []);
  const {
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
  } = useDealFilters(resetFocus);
  const { drawer, openDrawer, closeDrawer, keepIdsRef } = useDealDrawer(tableRef);
  const {
    isCollapsed: isOverviewCollapsed,
    toggle: toggleOverview,
    toggleRef: overviewToggleRef,
  } = useOverviewToggle();

  const queryRef = useRef(query);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    void loadDashboard(scope);
  }, [scope, session.role]);

  const { isLoading, error, reload, ensureRange } = useDealRows(query, keepIdsRef);
  useLiveUpdates(queryRef);
  const tabCounts = useViewTabCounts(countsQuery);

  const total = useDealStore((state) => state.total);
  const loadedAt = useDealStore((state) => state.loadedAt);
  const { selectAllState, toggleSelect, selectRange, toggleAll } = useRowSelection(
    query,
    total,
    filterKey
  );

  const now = useMemo(() => new Date(loadedAt), [loadedAt]);
  const activeIndex = Math.min(focusedIndex, Math.max(0, total - 1));

  const handleRangeChange = useCallback(
    (firstVisible: number, lastVisible: number) => {
      ensureRange(firstVisible, lastVisible);
      useDealStore.getState().setVisibleRange({ first: firstVisible, last: lastVisible });
    },
    [ensureRange]
  );

  const openDeal = useCallback(
    (dealId: string, index?: number) => {
      if (index !== undefined) {
        setFocusedIndex(index);
      }

      setIsSimOpen(false);
      openDrawer(dealId);
    },
    [openDrawer]
  );

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

  useGlobalShortcuts(!drawer && !isHelpOpen, {
    toggleStage,
    toggleOverview: () => toggleOverview({ keepFocus: true }),
    stepView,
    focusSearch: () => searchRef.current?.focus(),
    openHelp: () => setIsHelpOpen(true),
    moveByScreen: (direction) => tableRef.current?.moveByScreen(direction),
    focusFirstRow: () => tableRef.current?.focusFirstRow(),
  });

  return (
    <main className={drawer ? "app drawer-open" : "app"}>
      <AppHeader
        isSimOpen={isSimOpen}
        onToggleSim={() => setIsSimOpen((open) => !open)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {isSimOpen && <SimulationPanel onClose={() => setIsSimOpen(false)} />}

      <DashboardPanel
        activeStage={filters.stage}
        isCollapsed={isOverviewCollapsed}
        toggleRef={overviewToggleRef}
        onToggle={toggleOverview}
        onStageFilter={setStage}
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
          >
            {isOverviewCollapsed && (
              <button
                ref={overviewToggleRef}
                type="button"
                className="link-button overview-show"
                aria-expanded="false"
                onClick={() => toggleOverview()}
              >
                Show overview
              </button>
            )}
          </ViewTabs>

          <DealsToolbar
            searchRef={searchRef}
            searchInput={searchInput}
            stage={filters.stage}
            scope={scope}
            canViewTeam={permissions.canViewTeam}
            hasFilters={hasFilters}
            onSearchChange={setSearchInput}
            onStageChange={setStage}
            onScopeChange={setScope}
            onClearFilters={clearFilters}
            onGoToResults={() => tableRef.current?.focusFirstRow()}
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

        <LiveChangesPill onRefresh={reload} />

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
          onSort={sortBy}
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
