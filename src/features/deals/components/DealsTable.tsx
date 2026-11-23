import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { formatCount } from "../../../shared/format";
import { rowIdAt } from "../logic/rowBatches";
import { useDealStore } from "../store/dealStore";
import {
  DEAL_STAGES,
  type DealStage,
  type SortDirection,
  type SortKey,
} from "../types/deal.types";
import { DealRow } from "./DealRow";

export interface DealsTableHandle {
  focusActiveRow: () => void;
  moveByScreen: (direction: 1 | -1) => void;
}

export type SelectAllState = "all" | "some" | "none";

interface DealsTableProps {
  ref?: Ref<DealsTableHandle>;
  total: number;
  listKey: number;
  focusedIndex: number;
  isLoading: boolean;
  now: Date;
  sortKey: SortKey;
  sortDirection: SortDirection;
  selectAllState: SelectAllState;
  showOwner: boolean;
  emptyState: ReactNode;
  onSort: (key: SortKey) => void;
  onFocusedIndexChange: (index: number) => void;
  onOpen: (dealId: string, index: number) => void;
  onToggleSelect: (dealId: string, index: number, shiftKey: boolean) => void;
  onSelectRange: (fromIndex: number, toIndex: number) => void;
  onToggleAll: () => void;
  onStageKey: (stage: DealStage) => void;
  onRangeChange: (firstVisible: number, lastVisible: number) => void;
}

const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 40;

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "value", label: "Deal value" },
  { key: "closeDate", label: "Close date" },
  { key: "nextFollowUpAt", label: "Follow-up" },
  { key: "updatedAt", label: "Last updated" },
];

function PlaceholderRow({
  index,
  columns,
  isFocused,
  registerRow,
  onFocusRow,
}: {
  index: number;
  columns: number;
  isFocused: boolean;
  registerRow: (index: number, element: HTMLTableRowElement | null) => void;
  onFocusRow: (index: number) => void;
}) {
  return (
    <tr
      ref={(element) => registerRow(index, element)}
      className="placeholder-row"
      aria-busy="true"
      aria-rowindex={index + 2}
      tabIndex={isFocused ? 0 : -1}
      onFocus={() => onFocusRow(index)}
    >
      <td colSpan={columns}>
        <span className="placeholder-bar" />
        <span className="visually-hidden">Loading row {index + 1}</span>
      </td>
    </tr>
  );
}

interface VirtualRowProps {
  index: number;
  columns: number;
  isFocused: boolean;
  now: Date;
  showOwner: boolean;
  registerRow: (index: number, element: HTMLTableRowElement | null) => void;
  onFocusRow: (index: number) => void;
  onOpen: (dealId: string, index: number) => void;
  onToggleSelect: (dealId: string, index: number, shiftKey: boolean) => void;
}

function VirtualRow({ index, columns, ...rowProps }: VirtualRowProps) {
  const dealId = useDealStore((state) => rowIdAt(state.batches, index));

  if (!dealId) {
    return (
      <PlaceholderRow
        index={index}
        columns={columns}
        isFocused={rowProps.isFocused}
        registerRow={rowProps.registerRow}
        onFocusRow={rowProps.onFocusRow}
      />
    );
  }

  return <DealRow dealId={dealId} index={index} {...rowProps} />;
}

export function DealsTable({
  ref,
  total,
  listKey,
  focusedIndex,
  isLoading,
  now,
  sortKey,
  sortDirection,
  selectAllState,
  showOwner,
  emptyState,
  onSort,
  onFocusedIndexChange,
  onOpen,
  onToggleSelect,
  onSelectRange,
  onToggleAll,
  onStageKey,
  onRangeChange,
}: DealsTableProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowElements = useRef(new Map<number, HTMLTableRowElement>());
  const pendingFocus = useRef<number | null>(null);
  const tableHasFocus = useRef(false);
  const headerCheckbox = useRef<HTMLInputElement>(null);
  const columns = showOwner ? 10 : 9;

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    paddingStart: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
  });

  const items = virtualizer.getVirtualItems();
  const scrollOffset = virtualizer.scrollOffset ?? 0;
  const viewportHeight = virtualizer.scrollRect?.height ?? 0;
  const firstVisible = total === 0 ? 0 : Math.min(total - 1, Math.floor(scrollOffset / ROW_HEIGHT));
  const lastVisible =
    total === 0
      ? 0
      : Math.min(
          total - 1,
          Math.max(
            firstVisible,
            Math.floor((scrollOffset + viewportHeight - HEADER_HEIGHT) / ROW_HEIGHT) - 1
          )
        );
  const rowsPerScreen = Math.max(1, Math.floor((viewportHeight - HEADER_HEIGHT) / ROW_HEIGHT) - 1);

  const focusedIndexRef = useRef(focusedIndex);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  });

  const registerRow = useCallback(
    (index: number, element: HTMLTableRowElement | null) => {
      if (!element) {
        rowElements.current.delete(index);
        return;
      }

      rowElements.current.set(index, element);

      const focusWasLost =
        tableHasFocus.current &&
        (document.activeElement === document.body || document.activeElement === null);
      const shouldFocus =
        pendingFocus.current === index ||
        (focusWasLost && index === focusedIndexRef.current);

      if (shouldFocus && document.activeElement !== element) {
        element.focus({ preventScroll: true });
        pendingFocus.current = null;
      }
    },
    []
  );

  const focusIndex = useCallback(
    (index: number, align: "auto" | "start" = "auto") => {
      if (total === 0) {
        return;
      }

      const target = Math.max(0, Math.min(total - 1, index));

      focusedIndexRef.current = target;
      onFocusedIndexChange(target);
      virtualizer.scrollToIndex(target, { align });

      const row = rowElements.current.get(target);

      if (row) {
        row.focus({ preventScroll: true });
        pendingFocus.current = null;
      } else {
        pendingFocus.current = target;
      }
    },
    [total, onFocusedIndexChange, virtualizer]
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && !viewportRef.current?.contains(event.target)) {
        tableHasFocus.current = false;
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focusActiveRow: () => focusIndex(focusedIndex),
      moveByScreen: (direction) => {
        tableHasFocus.current = true;
        focusIndex(firstVisible + direction * rowsPerScreen, "start");
      },
    }),
    [focusIndex, focusedIndex, firstVisible, rowsPerScreen]
  );

  useEffect(() => {
    onRangeChange(firstVisible, lastVisible);
  }, [firstVisible, lastVisible, total, onRangeChange]);

  useEffect(() => {
    virtualizer.scrollToOffset(0);
  }, [listKey, virtualizer]);

  useEffect(() => {
    if (headerCheckbox.current) {
      headerCheckbox.current.indeterminate = selectAllState === "some";
    }
  }, [selectAllState]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (
      !(event.target instanceof HTMLTableRowElement) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    const key = event.key;
    const move = (delta: number) => {
      event.preventDefault();

      if (event.shiftKey && Math.abs(delta) === 1) {
        const next = Math.max(0, Math.min(total - 1, focusedIndex + delta));
        onSelectRange(Math.min(focusedIndex, next), Math.max(focusedIndex, next));
      }

      focusIndex(focusedIndex + delta);
    };

    if (key === "ArrowDown" || key === "j") {
      move(1);
      return;
    }

    if (key === "ArrowUp" || key === "k") {
      move(-1);
      return;
    }

    if (key === "PageDown") {
      move(rowsPerScreen);
      return;
    }

    if (key === "PageUp") {
      move(-rowsPerScreen);
      return;
    }

    if (key === "Home") {
      event.preventDefault();
      focusIndex(0);
      return;
    }

    if (key === "End") {
      event.preventDefault();
      focusIndex(total - 1);
      return;
    }

    const dealId = rowIdAt(useDealStore.getState().batches, focusedIndex);

    if (!dealId) {
      return;
    }

    if (key === " " || key === "x") {
      event.preventDefault();
      onToggleSelect(dealId, focusedIndex, event.shiftKey);
      return;
    }

    if (key === "Enter" || key === "o") {
      event.preventDefault();
      onOpen(dealId, focusedIndex);
      return;
    }

    const stageNumber = Number(key);

    if (stageNumber >= 1 && stageNumber <= DEAL_STAGES.length) {
      event.preventDefault();
      onStageKey(DEAL_STAGES[stageNumber - 1]);
    }
  }

  function ariaSort(key: SortKey): "ascending" | "descending" | "none" {
    if (key !== sortKey) {
      return "none";
    }

    return sortDirection === "asc" ? "ascending" : "descending";
  }

  function sortableHeader(key: SortKey) {
    const column = SORTABLE_COLUMNS.find((item) => item.key === key)!;
    const arrow = key === sortKey ? (sortDirection === "asc" ? " ↑" : " ↓") : "";

    return (
      <th aria-sort={ariaSort(key)} className={key === "value" ? "num" : undefined}>
        <button type="button" className="sort-button" onClick={() => onSort(key)}>
          {column.label}
          {arrow}
        </button>
      </th>
    );
  }

  const paddingTop = items.length > 0 ? items[0].start - HEADER_HEIGHT : 0;
  const paddingBottom =
    items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  return (
    <div className={`table-shell ${isLoading ? "table-loading" : ""}`}>
      {isLoading && total > 0 && (
        <div className="table-loading-bar" role="status">
          Updating…
        </div>
      )}

      <div
        ref={viewportRef}
        className="table-viewport"
        onKeyDown={handleKeyDown}
        onFocus={() => {
          tableHasFocus.current = true;
        }}
        onBlur={(event) => {
          const next = event.relatedTarget;

          if (next instanceof Node && !event.currentTarget.contains(next)) {
            tableHasFocus.current = false;
          }
        }}
      >
        <table
          id="deals-table"
          role="grid"
          aria-label="Deals"
          aria-busy={isLoading}
          aria-rowcount={total + 1}
          className={showOwner ? "with-owner" : undefined}
        >
          <colgroup>
            <col className="col-select" />
            <col className="col-deal" />
            <col className="col-company" />
            {showOwner && <col className="col-owner" />}
            <col className="col-stage" />
            <col className="col-value" />
            <col className="col-close" />
            <col className="col-follow-up" />
            <col className="col-updated" />
            <col className="col-status" />
          </colgroup>

          <thead>
            <tr aria-rowindex={1}>
              <th className="select-cell">
                <input
                  ref={headerCheckbox}
                  type="checkbox"
                  checked={selectAllState === "all"}
                  onChange={onToggleAll}
                  aria-label={`Select all ${formatCount(total)} deals in this view`}
                  disabled={total === 0}
                />
              </th>
              <th>Deal</th>
              <th>Company</th>
              {showOwner && <th>Owner</th>}
              <th>Stage</th>
              {sortableHeader("value")}
              {sortableHeader("closeDate")}
              {sortableHeader("nextFollowUpAt")}
              {sortableHeader("updatedAt")}
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {total === 0 ? (
              <tr>
                <td colSpan={columns} className="empty-state">
                  {isLoading ? "Loading deals…" : emptyState}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr className="spacer-row" aria-hidden="true" style={{ height: paddingTop }}>
                    <td colSpan={columns} />
                  </tr>
                )}

                {items.map((item) => (
                  <VirtualRow
                    key={item.index}
                    index={item.index}
                    columns={columns}
                    isFocused={item.index === focusedIndex}
                    now={now}
                    showOwner={showOwner}
                    registerRow={registerRow}
                    onFocusRow={onFocusedIndexChange}
                    onOpen={onOpen}
                    onToggleSelect={onToggleSelect}
                  />
                ))}

                {paddingBottom > 0 && (
                  <tr className="spacer-row" aria-hidden="true" style={{ height: paddingBottom }}>
                    <td colSpan={columns} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>
          {total === 0
            ? "No deals"
            : `Rows ${formatCount(firstVisible + 1)}–${formatCount(lastVisible + 1)} of ${formatCount(total)}`}
        </span>
        <span className="pagination-hint">Page Up / Page Down move one screen · Home / End jump</span>
        <button
          type="button"
          className="link-button"
          disabled={firstVisible === 0}
          onClick={() => focusIndex(0)}
        >
          Back to top ↑
        </button>
      </div>
    </div>
  );
}
