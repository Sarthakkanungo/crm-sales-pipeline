import { useEffect, useRef, useState } from "react";
import { formatCount } from "../../../shared/format";
import {
  applyMineToConflicts,
  cancelBulkConfirm,
  cancelBulkRun,
  closeBulkResult,
  confirmBulkMove,
  requestBulkMove,
  retryFailedBulk,
  undoBulk,
} from "../actions/bulkActions";
import type { BulkOutcome } from "../logic/bulkMove";
import { EMPTY_SELECTION, selectionCount } from "../logic/selection";
import { useBulkStore } from "../store/bulkStore";
import { useDealStore } from "../store/dealStore";
import { DEAL_STAGES, type DealStage } from "../types/deal.types";

const DETAIL_LIMIT = 50;

type FailedItem = BulkOutcome["failed"][number];

interface FailureGroup {
  key: string;
  message: string;
  retryable: boolean;
  items: FailedItem[];
}

function groupFailures(failed: readonly FailedItem[]): FailureGroup[] {
  const groups = new Map<string, FailureGroup>();

  for (const item of failed) {
    const key = `${item.retryable}:${item.message}`;
    const group = groups.get(key);

    if (group) {
      group.items.push(item);
    } else {
      groups.set(key, {
        key,
        message: item.message,
        retryable: item.retryable,
        items: [item],
      });
    }
  }

  return [...groups.values()];
}

export function BulkBar() {
  const selection = useDealStore((state) => state.selection);
  const setSelection = useDealStore((state) => state.setSelection);
  const run = useBulkStore((state) => state.run);
  const confirm = useBulkStore((state) => state.confirm);

  const [targetStage, setTargetStage] = useState<DealStage | "">("");
  const [showDetails, setShowDetails] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const count = selectionCount(selection);
  const isRunning = run?.status === "preparing" || run?.status === "running";

  useEffect(() => {
    if (confirm) {
      confirmButtonRef.current?.focus();
    }
  }, [confirm]);

  if (count === 0 && !run && !confirm) {
    return null;
  }

  const outcome = run?.outcome;
  const retryableCount = outcome
    ? outcome.failed.filter((item) => item.retryable).length +
      outcome.notAttempted.length
    : 0;
  const percent = run && run.total > 0 ? Math.round((run.processed / run.total) * 100) : 0;

  return (
    <section className="bulk-bar" aria-label="Bulk actions">
      {count > 0 && !confirm && (
        <div className="bulk-row">
          <strong>{formatCount(count)} selected</strong>

          <label className="bulk-target">
            <span>Move to</span>
            <select
              value={targetStage}
              onChange={(event) => setTargetStage(event.target.value as DealStage | "")}
              disabled={isRunning}
            >
              <option value="">Choose stage</option>
              {DEAL_STAGES.map((stage, index) => (
                <option key={stage} value={stage}>
                  {index + 1}. {stage}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="primary-button"
            disabled={!targetStage || isRunning}
            onClick={() => targetStage && requestBulkMove(targetStage)}
          >
            Move {formatCount(count)}
          </button>

          <button
            type="button"
            className="link-button"
            onClick={() => setSelection(EMPTY_SELECTION)}
          >
            Clear selection
          </button>
        </div>
      )}

      {selection.mode === "query" && !confirm && (
        <p className="bulk-hint">
          Every deal in this view is selected ({formatCount(count)}). Deals that
          teammates add to this view before you press Move will be included.
        </p>
      )}

      {confirm && (
        <div className="bulk-row bulk-confirm" role="alertdialog" aria-label="Confirm bulk move">
          <strong>
            Move {formatCount(confirm.count)} deals to {confirm.targetStage}?
          </strong>
          <span>This closes them in the pipeline. You can undo right after.</span>
          <button
            ref={confirmButtonRef}
            type="button"
            className="danger-button"
            onClick={confirmBulkMove}
          >
            Yes, move {formatCount(confirm.count)}
          </button>
          <button type="button" className="link-button" onClick={cancelBulkConfirm}>
            Cancel
          </button>
        </div>
      )}

      {run && isRunning && (
        <div className="bulk-row" role="status" aria-live="polite">
          <strong>
            {run.status === "preparing"
              ? "Preparing bulk move…"
              : `${run.kind === "undo" ? "Undoing" : `Moving to ${run.targetLabel}`}: ${formatCount(run.processed)} / ${formatCount(run.total)}`}
          </strong>
          <progress max={100} value={percent} aria-label="Bulk move progress" />
          <button type="button" className="link-button" onClick={cancelBulkRun}>
            Cancel
          </button>
        </div>
      )}

      {run?.status === "done" && outcome && (
        <div className="bulk-result" role="status">
          <p>
            <strong>
              {run.cancelled ? "Bulk move cancelled. " : "Bulk move finished. "}
            </strong>
            <span className="result-ok">{formatCount(outcome.saved.length)} moved</span>
            {outcome.failed.length > 0 && (
              <span className="result-failed">
                {formatCount(outcome.failed.length)} failed
              </span>
            )}
            {outcome.conflicts.length > 0 && (
              <span className="result-conflict">
                {formatCount(outcome.conflicts.length)} changed by teammates
              </span>
            )}
            {run.skipped + outcome.alreadyInTarget.length > 0 && (
              <span className="result-muted">
                {formatCount(run.skipped + outcome.alreadyInTarget.length)} already there
              </span>
            )}
            {outcome.notAttempted.length > 0 && (
              <span className="result-muted">
                {formatCount(outcome.notAttempted.length)} not sent
              </span>
            )}
          </p>

          <div className="bulk-actions">
            {retryableCount > 0 && (
              <button type="button" onClick={() => void retryFailedBulk()}>
                Retry {formatCount(retryableCount)}
              </button>
            )}
            {outcome.conflicts.length > 0 && (
              <button type="button" onClick={() => void applyMineToConflicts()}>
                Apply mine to {formatCount(outcome.conflicts.length)} changed
              </button>
            )}
            {outcome.saved.length > 0 && run.kind !== "undo" && (
              <button type="button" onClick={() => void undoBulk()}>
                Undo {formatCount(outcome.saved.length)}
              </button>
            )}
            {(outcome.failed.length > 0 || outcome.conflicts.length > 0) && (
              <button
                type="button"
                className="link-button"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((value) => !value)}
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>
            )}
            <button type="button" className="link-button" onClick={closeBulkResult}>
              Close
            </button>
          </div>

          {showDetails && (
            <div className="bulk-details">
              {groupFailures(outcome.failed).map((group) => (
                <section key={group.key} className="bulk-detail-group">
                  <h4 className="bulk-detail-title result-failed">
                    {formatCount(group.items.length)} not saved
                  </h4>
                  <p className="bulk-detail-help">
                    <strong>Reason:</strong> {group.message}{" "}
                    {group.retryable
                      ? "These deals were not changed and are still in their old stage. This is usually temporary, so press Retry to send them again."
                      : "These deals were not changed, and retrying will not help."}
                  </p>
                  <ul className="bulk-detail-list">
                    {group.items.slice(0, DETAIL_LIMIT).map(({ request }) => (
                      <li key={request.id}>
                        <span className="bulk-detail-deal">
                          <strong>{request.companyName}</strong> · {request.name}
                        </span>
                        <span className="bulk-detail-change">
                          Still in {request.fromStage}, not moved to {request.newStage}
                        </span>
                        <span className="bulk-detail-id">{request.id}</span>
                      </li>
                    ))}
                  </ul>
                  {group.items.length > DETAIL_LIMIT && (
                    <p className="bulk-detail-more">
                      {formatCount(group.items.length - DETAIL_LIMIT)} more not listed here.
                      {group.retryable && " Retry sends all of them again."}
                    </p>
                  )}
                </section>
              ))}

              {outcome.conflicts.length > 0 && (
                <section className="bulk-detail-group">
                  <h4 className="bulk-detail-title result-conflict">
                    {formatCount(outcome.conflicts.length)} changed by teammates
                  </h4>
                  <p className="bulk-detail-help">
                    A teammate moved these after you selected them, so your move was
                    not applied. Press Apply mine to move them anyway, or leave them
                    where your teammate put them.
                  </p>
                  <ul className="bulk-detail-list">
                    {outcome.conflicts.slice(0, DETAIL_LIMIT).map(({ latestDeal, request }) => (
                      <li key={latestDeal.id}>
                        <span className="bulk-detail-deal">
                          <strong>{latestDeal.companyName}</strong> · {latestDeal.name}
                        </span>
                        <span className="bulk-detail-change">
                          {latestDeal.updatedBy} moved it to {latestDeal.stage}, you
                          wanted {request.newStage}
                        </span>
                        <span className="bulk-detail-id">{latestDeal.id}</span>
                      </li>
                    ))}
                  </ul>
                  {outcome.conflicts.length > DETAIL_LIMIT && (
                    <p className="bulk-detail-more">
                      {formatCount(outcome.conflicts.length - DETAIL_LIMIT)} more not
                      listed here. Apply mine covers all of them.
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
