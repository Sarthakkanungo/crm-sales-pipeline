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
import { EMPTY_SELECTION, selectionCount } from "../logic/selection";
import { useBulkStore } from "../store/bulkStore";
import { useDealStore } from "../store/dealStore";
import { DEAL_STAGES, type DealStage } from "../types/deal.types";

const DETAIL_LIMIT = 50;

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
            <ul className="bulk-details">
              {outcome.conflicts.slice(0, DETAIL_LIMIT).map(({ latestDeal, request }) => (
                <li key={`c-${latestDeal.id}`}>
                  {latestDeal.companyName} · {latestDeal.name} ({latestDeal.id}):{" "}
                  {latestDeal.updatedBy} moved it to {latestDeal.stage}, you wanted{" "}
                  {request.newStage}
                </li>
              ))}
              {outcome.failed.slice(0, DETAIL_LIMIT).map(({ request, message }) => (
                <li key={`f-${request.id}`}>
                  {request.id}: {message}
                </li>
              ))}
              {outcome.conflicts.length + outcome.failed.length > DETAIL_LIMIT * 2 && (
                <li>…and more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
