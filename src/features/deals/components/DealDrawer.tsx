import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { CURRENT_USER } from "../../../config/currentUser";
import { trapTabKey } from "../../../shared/focus";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  stageClassName,
} from "../../../shared/format";
import {
  addNote,
  dismissSaveProblem,
  moveDeal,
  retrySave,
  saveFollowUp,
} from "../actions/dealActions";
import { simulateTeammateEditWithFeedback } from "../actions/simulationActions";
import { useDealStore } from "../store/dealStore";
import { DEAL_STAGES, type DealStage } from "../types/deal.types";

interface DealDrawerProps {
  dealId: string;
  openedAt: number;
  onClose: () => void;
}

type FormStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

const IDLE: FormStatus = { kind: "idle" };

export function DealDrawer({ dealId, openedAt, onClose }: DealDrawerProps) {
  const deal = useDealStore((state) => state.dealsById[dealId]);
  const save = useDealStore((state) => state.saves[dealId]);
  const live = useDealStore((state) => state.liveMarks[dealId]);

  const [targetStage, setTargetStage] = useState<DealStage | "">("");
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState<FormStatus>(IDLE);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState<FormStatus>(IDLE);

  const dialogRef = useRef<HTMLDivElement>(null);
  const stageSelectRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();

  useEffect(() => {
    stageSelectRef.current?.focus();
  }, []);

  if (!deal) {
    return null;
  }

  const shownStage = save?.kind === "saving" ? save.targetStage : deal.stage;
  const changedWhileOpen = live && live.at >= openedAt;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    trapTabKey(event, dialogRef.current);
  }

  function handleMove(): void {
    if (!targetStage) {
      return;
    }

    void moveDeal(dealId, targetStage);
    setTargetStage("");
    onClose();
  }

  async function handleAddNote(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const text = noteText.trim();

    if (!text) {
      return;
    }

    setNoteStatus({ kind: "saving" });
    const result = await addNote(dealId, text);

    if (result.ok) {
      setNoteText("");
      setNoteStatus({ kind: "success", message: "Note saved." });
    } else {
      setNoteStatus({
        kind: "error",
        message: `${result.message} Your text is kept, press Save note to retry.`,
      });
    }
  }

  async function handleSaveFollowUp(): Promise<void> {
    if (!followUpDate) {
      return;
    }

    setFollowUpStatus({ kind: "saving" });
    const result = await saveFollowUp(dealId, new Date(followUpDate).toISOString());

    if (!result) {
      setFollowUpStatus(IDLE);
    } else if (result.status === "success") {
      setFollowUpDate("");
      setFollowUpStatus({ kind: "success", message: "Follow-up saved." });
    } else if (result.status === "conflict") {
      setFollowUpStatus({
        kind: "error",
        message: `${result.latestDeal.updatedBy} changed this deal first. The latest data is shown, check it and save again.`,
      });
    } else {
      setFollowUpStatus({
        kind: "error",
        message: `${result.message} Press Save follow-up to retry.`,
      });
    }
  }

  return (
    <div
      className="drawer-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="deal-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <div className="drawer-header">
          <div>
            <h2 id={titleId}>{deal.name}</h2>
            <p>{deal.companyName}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="close-button"
            aria-label="Close deal details"
          >
            ×
          </button>
        </div>

        {changedWhileOpen && (
          <p className="drawer-banner" role="status">
            {live.by} moved this deal from {live.fromStage} to {live.toStage}{" "}
            while you had it open. You are looking at the latest version.
          </p>
        )}

        <div className="deal-details">
          <div>
            <span>Deal value</span>
            <strong>{formatCurrency(deal.value, deal.currency)}</strong>
          </div>
          <div>
            <span>Licence count</span>
            <strong>{deal.licenceCount}</strong>
          </div>
          <div>
            <span>Owner</span>
            <strong>{deal.ownerName}</strong>
          </div>
          <div>
            <span>Stage</span>
            <strong>
              <span className={stageClassName(shownStage)}>{shownStage}</span>
            </strong>
          </div>
          <div>
            <span>Close date</span>
            <strong>{deal.closeDate ? formatDate(deal.closeDate) : "Not set"}</strong>
          </div>
          <div>
            <span>Last updated</span>
            <strong>
              {deal.updatedBy === CURRENT_USER ? "You" : deal.updatedBy} ·{" "}
              {formatDateTime(deal.updatedAt)}
            </strong>
          </div>
        </div>

        <section className="stage-update-section" aria-labelledby={`${titleId}-stage`}>
          <h3 id={`${titleId}-stage`}>Move deal</h3>

          <label htmlFor={`${titleId}-stage-select`}>New stage</label>
          <select
            id={`${titleId}-stage-select`}
            ref={stageSelectRef}
            value={targetStage}
            onChange={(event) => setTargetStage(event.target.value as DealStage | "")}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleMove();
              }
            }}
            disabled={save?.kind === "bulk"}
          >
            <option value="">Select a stage</option>
            {DEAL_STAGES.map((stage) => (
              <option key={stage} value={stage} disabled={stage === shownStage}>
                {stage}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleMove}
            disabled={!targetStage || targetStage === shownStage || save?.kind === "bulk"}
          >
            Move
          </button>

          <div aria-live="polite">
            {save?.kind === "saving" && (
              <p className="stage-pending">Saving move to {save.targetStage}…</p>
            )}

            {save?.kind === "bulk" && (
              <p className="stage-pending">
                Part of a running bulk move to {save.targetStage}.
              </p>
            )}

            {save?.kind === "failed" && (
              <div className="stage-error">
                <p>
                  Move to {save.targetStage} was not saved. {save.message}
                </p>
                {save.retryable && (
                  <button type="button" onClick={() => retrySave(dealId)}>
                    Retry
                  </button>
                )}
                <button type="button" onClick={() => dismissSaveProblem(dealId)}>
                  Dismiss
                </button>
              </div>
            )}

            {save?.kind === "conflict" && (
              <div className="stage-error">
                <p>
                  {save.changedBy} moved this deal to {save.theirStage} before your
                  move to {save.targetStage} was saved.
                </p>
                <button type="button" onClick={() => retrySave(dealId)}>
                  Apply my move
                </button>
                <button type="button" onClick={() => dismissSaveProblem(dealId)}>
                  Keep {save.theirStage}
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="sim-inline">
          <span>Simulator</span>
          <button type="button" onClick={() => simulateTeammateEditWithFeedback(dealId)}>
            Simulate a teammate edit
          </button>
          <p>
            A teammate moves this deal right now. Press it while your move is still
            saving to see a conflict.
          </p>
        </div>

        <section className="follow-up-form">
          <h3>Next follow-up</h3>
          <p>
            Current:{" "}
            {deal.nextFollowUpAt ? formatDateTime(deal.nextFollowUpAt) : "Not scheduled"}
          </p>

          <label htmlFor={`${titleId}-follow-up`}>Date and time</label>
          <input
            id={`${titleId}-follow-up`}
            type="datetime-local"
            value={followUpDate}
            onChange={(event) => setFollowUpDate(event.target.value)}
            disabled={followUpStatus.kind === "saving"}
          />

          <button
            type="button"
            onClick={handleSaveFollowUp}
            disabled={followUpStatus.kind === "saving" || !followUpDate}
          >
            {followUpStatus.kind === "saving" ? "Saving…" : "Save follow-up"}
          </button>

          {followUpStatus.kind === "error" && (
            <p className="error-message" role="alert">
              {followUpStatus.message}
            </p>
          )}
          {followUpStatus.kind === "success" && (
            <p className="stage-success" role="status">
              {followUpStatus.message}
            </p>
          )}
        </section>

        <section className="notes-section">
          <h3>Notes ({deal.notes.length})</h3>

          <form onSubmit={handleAddNote} className="note-form">
            <label htmlFor={`${titleId}-note`}>Add a note</label>
            <textarea
              id={`${titleId}-note`}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Write your conversation notes…"
              rows={4}
              disabled={noteStatus.kind === "saving"}
            />

            {noteStatus.kind === "error" && (
              <p className="error-message" role="alert">
                {noteStatus.message}
              </p>
            )}
            {noteStatus.kind === "success" && (
              <p className="stage-success" role="status">
                {noteStatus.message}
              </p>
            )}

            <button
              type="submit"
              disabled={noteStatus.kind === "saving" || !noteText.trim()}
            >
              {noteStatus.kind === "saving" ? "Saving…" : "Save note"}
            </button>
          </form>

          <div className="notes-list">
            {deal.notes.length === 0 ? (
              <p>No notes yet.</p>
            ) : (
              [...deal.notes].reverse().map((note) => (
                <div key={note.id} className="note-card">
                  <p>{note.text}</p>
                  <small>
                    {note.createdBy} · {formatDateTime(note.createdAt)}
                  </small>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
