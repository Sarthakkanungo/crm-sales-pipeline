import { formatCount } from "../../../shared/format";
import { showToast, useToastStore } from "../../../shared/toastStore";
import {
  runBulkMove,
  type BulkOutcome,
  type BulkRequest,
} from "../logic/bulkMove";
import { EMPTY_SELECTION, selectionCount } from "../logic/selection";
import {
  getBulkCandidates,
  updateDealsStage,
} from "../services/dealService";
import { useBulkStore, type BulkKind } from "../store/bulkStore";
import { useDealStore, type SaveStatus } from "../store/dealStore";
import type { DealStage } from "../types/deal.types";
import { moveDeal, recordStageChangeInDashboard } from "./dealActions";

const CHUNK_SIZE = 200;
const CONCURRENCY = 3;
const DESTRUCTIVE_STAGES: readonly DealStage[] = ["Won", "Lost"];

function isBulkRunning(): boolean {
  const status = useBulkStore.getState().run?.status;
  return status === "preparing" || status === "running";
}

function singleSelectedId(): string | null {
  const { selection } = useDealStore.getState();

  if (selection.mode !== "ids") {
    return null;
  }

  const ids = Object.keys(selection.items);
  return ids.length === 1 ? ids[0] : null;
}

export function requestBulkMove(targetStage: DealStage): void {
  const count = selectionCount(useDealStore.getState().selection);

  if (count === 0) {
    return;
  }

  const singleId = singleSelectedId();

  if (singleId) {
    useDealStore.getState().setSelection(EMPTY_SELECTION);
    void moveDeal(singleId, targetStage);
    return;
  }

  if (isBulkRunning()) {
    showToast({
      tone: "info",
      message: "A bulk move is already running. Wait for it or cancel it first.",
      actions: [],
      sticky: false,
    });
    return;
  }

  if (DESTRUCTIVE_STAGES.includes(targetStage)) {
    useBulkStore.getState().setConfirm({ targetStage, count });
    return;
  }

  void startBulkMove(targetStage);
}

export function confirmBulkMove(): void {
  const { confirm, setConfirm } = useBulkStore.getState();

  if (!confirm) {
    return;
  }

  setConfirm(null);
  void startBulkMove(confirm.targetStage);
}

export function cancelBulkConfirm(): void {
  useBulkStore.getState().setConfirm(null);
}

export function cancelBulkRun(): void {
  useBulkStore.getState().controller?.abort();
}

export function closeBulkResult(): void {
  if (!isBulkRunning()) {
    useBulkStore.getState().setRun(null);
  }
}

async function startBulkMove(targetStage: DealStage): Promise<void> {
  const { selection, setSelection } = useDealStore.getState();
  const bulk = useBulkStore.getState();

  bulk.setRun({
    kind: "move",
    targetLabel: targetStage,
    status: "preparing",
    processed: 0,
    total: selectionCount(selection),
    skipped: 0,
    cancelled: false,
    outcome: null,
  });

  let candidates: Array<{ id: string; version: number; stage: DealStage }>;

  if (selection.mode === "ids") {
    candidates = Object.entries(selection.items).map(([id, item]) => ({
      id,
      version: item.version,
      stage: item.stage,
    }));
  } else {
    try {
      const matches = await getBulkCandidates(selection.query);
      candidates = matches.filter((item) => !(item.id in selection.excluded));
    } catch {
      bulk.setRun(null);
      showToast({
        tone: "error",
        message: "Could not load the deals for this bulk move. Nothing was changed.",
        actions: [],
        sticky: true,
      });
      return;
    }
  }

  const requests: BulkRequest[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    if (candidate.stage === targetStage) {
      skipped += 1;
    } else {
      requests.push({
        id: candidate.id,
        fromStage: candidate.stage,
        newStage: targetStage,
        expectedVersion: candidate.version,
      });
    }
  }

  setSelection(EMPTY_SELECTION);
  await executeBulk(requests, "move", targetStage, skipped);
}

function applyChunk(chunk: BulkOutcome): void {
  const store = useDealStore.getState();
  const updates: Record<string, SaveStatus | null> = {};

  for (const { request, deal } of chunk.saved) {
    recordStageChangeInDashboard(deal, request.fromStage, deal.stage);
    updates[deal.id] = null;
  }

  for (const { deal } of chunk.alreadyInTarget) {
    updates[deal.id] = null;
  }

  for (const { request, latestDeal } of chunk.conflicts) {
    updates[request.id] = {
      kind: "conflict",
      targetStage: request.newStage,
      changedBy: latestDeal.updatedBy,
      theirStage: latestDeal.stage,
    };
  }

  for (const { request, message, retryable } of chunk.failed) {
    updates[request.id] = {
      kind: "failed",
      targetStage: request.newStage,
      message,
      retryable,
    };
  }

  store.upsertDeals([
    ...chunk.saved.map((item) => item.deal),
    ...chunk.alreadyInTarget.map((item) => item.deal),
    ...chunk.conflicts.map((item) => item.latestDeal),
  ]);

  const visibleUpdates = Object.fromEntries(
    Object.entries(updates).filter(([id]) => id in store.dealsById)
  );

  store.setSaves(visibleUpdates);
}

function summarise(outcome: BulkOutcome, skipped: number): string {
  const parts = [`${formatCount(outcome.saved.length)} moved`];

  if (outcome.failed.length) {
    parts.push(`${formatCount(outcome.failed.length)} failed`);
  }

  if (outcome.conflicts.length) {
    parts.push(`${formatCount(outcome.conflicts.length)} changed by teammates`);
  }

  const unchanged = skipped + outcome.alreadyInTarget.length;

  if (unchanged) {
    parts.push(`${formatCount(unchanged)} already there`);
  }

  if (outcome.notAttempted.length) {
    parts.push(`${formatCount(outcome.notAttempted.length)} cancelled`);
  }

  return parts.join(" · ");
}

async function executeBulk(
  requests: BulkRequest[],
  kind: BulkKind,
  targetLabel: string,
  skipped: number
): Promise<void> {
  const bulk = useBulkStore.getState();
  const controller = new AbortController();

  bulk.setController(controller);
  bulk.setRun({
    kind,
    targetLabel,
    status: "running",
    processed: 0,
    total: requests.length,
    skipped,
    cancelled: false,
    outcome: null,
  });

  const store = useDealStore.getState();
  const pending: Record<string, SaveStatus> = {};

  for (const request of requests) {
    if (request.id in store.dealsById) {
      pending[request.id] = { kind: "bulk", targetStage: request.newStage };
    }
  }

  store.setSaves(pending);

  const outcome = await runBulkMove(requests, {
    send: updateDealsStage,
    chunkSize: CHUNK_SIZE,
    concurrency: CONCURRENCY,
    signal: controller.signal,
    onChunk: (chunk, progress) => {
      applyChunk(chunk);
      useBulkStore.getState().patchRun({ processed: progress.processed });
    },
  });

  const cleared: Record<string, null> = {};

  for (const request of outcome.notAttempted) {
    cleared[request.id] = null;
  }

  useDealStore.getState().setSaves(cleared);
  useDealStore.getState().noteDataChanged();
  useBulkStore.getState().setController(null);
  useBulkStore.getState().patchRun({
    status: "done",
    cancelled: controller.signal.aborted,
    outcome,
  });

  const hasProblems = outcome.failed.length > 0 || outcome.conflicts.length > 0;

  showToast({
    key: "bulk",
    tone: hasProblems ? "warning" : "success",
    message: `Bulk ${kind === "undo" ? "undo" : `move to ${targetLabel}`}: ${summarise(outcome, skipped)}.`,
    actions: [],
    sticky: hasProblems,
  });

  if (outcome.saved.length > 0 && kind !== "undo") {
    useToastStore.getState().setLastUndo({
      label: `Undo bulk move of ${outcome.saved.length} deals`,
      run: () => void undoBulk(outcome),
    });
  }
}

export async function retryFailedBulk(): Promise<void> {
  const outcome = useBulkStore.getState().run?.outcome;

  if (!outcome || isBulkRunning()) {
    return;
  }

  const requests = [
    ...outcome.failed.filter((item) => item.retryable).map((item) => item.request),
    ...outcome.notAttempted,
  ];

  if (requests.length) {
    await executeBulk(requests, "retry", requests[0].newStage, 0);
  }
}

export async function applyMineToConflicts(): Promise<void> {
  const outcome = useBulkStore.getState().run?.outcome;

  if (!outcome || isBulkRunning()) {
    return;
  }

  const requests: BulkRequest[] = outcome.conflicts
    .filter(({ request, latestDeal }) => latestDeal.stage !== request.newStage)
    .map(({ request, latestDeal }) => ({
      id: request.id,
      fromStage: latestDeal.stage,
      newStage: request.newStage,
      expectedVersion: latestDeal.version,
    }));

  if (requests.length) {
    await executeBulk(requests, "conflicts", requests[0].newStage, 0);
  }
}

export async function undoBulk(
  outcome = useBulkStore.getState().run?.outcome
): Promise<void> {
  if (!outcome || isBulkRunning()) {
    return;
  }

  const requests: BulkRequest[] = outcome.saved.map(({ request, deal }) => ({
    id: deal.id,
    fromStage: deal.stage,
    newStage: request.fromStage,
    expectedVersion: deal.version,
  }));

  if (requests.length) {
    useToastStore.getState().setLastUndo(null);
    await executeBulk(requests, "undo", "previous stages", 0);
  }
}
