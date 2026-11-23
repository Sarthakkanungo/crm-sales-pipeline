import { memo, type MouseEvent } from "react";
import { CURRENT_USER } from "../../../config/currentUser";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  stageClassName,
} from "../../../shared/format";
import { dismissSaveProblem, retrySave } from "../actions/dealActions";
import { getFollowUpBucket } from "../logic/dealQuery";
import { isSelected } from "../logic/selection";
import { useDealStore, type LiveMark, type SaveStatus } from "../store/dealStore";

interface DealRowProps {
  dealId: string;
  index: number;
  isFocused: boolean;
  now: Date;
  registerRow: (index: number, element: HTMLTableRowElement | null) => void;
  onFocusRow: (index: number) => void;
  onOpen: (dealId: string, index: number) => void;
  onToggleSelect: (dealId: string, index: number, shiftKey: boolean) => void;
  showOwner: boolean;
}

function stopRowClick(event: MouseEvent): void {
  event.stopPropagation();
}

function SaveStatusCell({
  dealId,
  save,
  live,
  onOpen,
}: {
  dealId: string;
  save: SaveStatus | undefined;
  live: LiveMark | undefined;
  onOpen: () => void;
}) {
  if (save?.kind === "saving") {
    return <span className="row-status row-status-saving">Saving…</span>;
  }

  if (save?.kind === "bulk") {
    return (
      <span className="row-status row-status-saving">
        Queued → {save.targetStage}
      </span>
    );
  }

  if (save?.kind === "failed") {
    return (
      <span className="row-status row-status-failed" onClick={stopRowClick}>
        Not saved
        {save.retryable && (
          <button type="button" tabIndex={-1} onClick={() => retrySave(dealId)}>
            Retry
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Dismiss"
          onClick={() => dismissSaveProblem(dealId)}
        >
          ×
        </button>
      </span>
    );
  }

  if (save?.kind === "conflict") {
    return (
      <span
        className="row-status row-status-conflict"
        title={`${save.changedBy} changed this deal before your move was saved`}
        onClick={stopRowClick}
      >
        Conflict
        <button type="button" tabIndex={-1} onClick={onOpen}>
          Review
        </button>
      </span>
    );
  }

  if (live && !live.matchesView) {
    return (
      <span
        className="row-status row-status-stale"
        title={`${live.by} moved this deal to ${live.toStage}. It no longer matches this view.`}
      >
        Moved away
      </span>
    );
  }

  if (live?.fresh) {
    return (
      <span className="row-status row-status-live" title={`Updated by ${live.by}`}>
        Updated by {live.by}
      </span>
    );
  }

  return null;
}

export const DealRow = memo(function DealRow({
  dealId,
  index,
  isFocused,
  now,
  registerRow,
  onFocusRow,
  onOpen,
  onToggleSelect,
  showOwner,
}: DealRowProps) {
  const deal = useDealStore((state) => state.dealsById[dealId]);
  const save = useDealStore((state) => state.saves[dealId]);
  const live = useDealStore((state) => state.liveMarks[dealId]);
  const selected = useDealStore((state) => isSelected(state.selection, dealId));

  if (!deal) {
    return null;
  }

  const shownStage = save?.kind === "saving" ? save.targetStage : deal.stage;
  const followUpBucket = getFollowUpBucket(deal, now);
  const isStale = Boolean(live && !live.matchesView);

  const className = [
    "deal-row",
    index % 2 === 1 ? "row-even" : "",
    selected ? "deal-row-selected" : "",
    live?.fresh ? "deal-row-live" : "",
    isStale ? "deal-row-stale" : "",
    save?.kind === "failed" ? "deal-row-failed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr
      ref={(element) => registerRow(index, element)}
      data-deal-id={dealId}
      className={className}
      tabIndex={isFocused ? 0 : -1}
      aria-selected={selected}
      aria-rowindex={index + 2}
      onFocus={() => onFocusRow(index)}
      onClick={() => onOpen(dealId, index)}
    >
      <td className="select-cell" onClick={stopRowClick}>
        <input
          type="checkbox"
          tabIndex={-1}
          checked={selected}
          readOnly
          aria-label={`Select ${deal.companyName} ${deal.name}`}
          onClick={(event) => onToggleSelect(dealId, index, event.shiftKey)}
        />
      </td>

      <td>
        <strong className="deal-name">{deal.name}</strong>
        <span className="deal-id">{deal.id}</span>
      </td>

      <td>{deal.companyName}</td>

      {showOwner && (
        <td>{deal.ownerName === CURRENT_USER ? "You" : deal.ownerName}</td>
      )}

      <td>
        <span className={stageClassName(shownStage)}>{shownStage}</span>
      </td>

      <td className="deal-value">{formatCurrency(deal.value, deal.currency)}</td>

      <td>{deal.closeDate ? formatDate(deal.closeDate) : "—"}</td>

      <td>
        {deal.nextFollowUpAt ? (
          <span className="follow-up-cell">
            {formatDateTime(deal.nextFollowUpAt)}
            {followUpBucket === "overdue" && (
              <span className="status-badge status-overdue">Overdue</span>
            )}
            {followUpBucket === "dueToday" && (
              <span className="status-badge status-today">Today</span>
            )}
          </span>
        ) : (
          "—"
        )}
      </td>

      <td className="updated-cell">
        {deal.updatedBy === CURRENT_USER ? "You" : deal.updatedBy}
        <span>{formatRelativeTime(deal.updatedAt, now.getTime())}</span>
      </td>

      <td>
        <SaveStatusCell
          dealId={dealId}
          save={save}
          live={live}
          onOpen={() => onOpen(dealId, index)}
        />
      </td>
    </tr>
  );
});
