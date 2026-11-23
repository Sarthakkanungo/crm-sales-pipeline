import { CURRENT_USER } from "../../../config/currentUser";
import { showToast, useToastStore } from "../../../shared/toastStore";
import { applyStageChange } from "../logic/dashboard";
import { createOrderedDealWriter } from "../logic/writeQueue";
import {
  addDealNote,
  getDashboardData,
  updateDealFollowUp,
  updateDealStage,
} from "../services/dealService";
import {
  syncSelectionWithOwnSave,
  useDealStore,
} from "../store/dealStore";
import type {
  Deal,
  DealScope,
  DealStage,
  DealUpdateResult,
} from "../types/deal.types";

const dealWriter = createOrderedDealWriter();
let nextSaveToken = 0;

function describeDeal(deal: Deal): string {
  return `${deal.companyName} · ${deal.name}`;
}

function displayName(user: string): string {
  return user === CURRENT_USER ? "You" : user;
}

export function isInDashboardScope(deal: Deal): boolean {
  const { dashboardScope } = useDealStore.getState();

  return dashboardScope === "all" || deal.ownerName === CURRENT_USER;
}

export function recordStageChangeInDashboard(
  deal: Deal,
  fromStage: DealStage,
  toStage: DealStage
): void {
  if (!isInDashboardScope(deal)) {
    return;
  }

  const now = new Date();

  useDealStore
    .getState()
    .patchDashboard((dashboard) =>
      applyStageChange(dashboard, deal, fromStage, toStage, now)
    );
}

export async function loadDashboard(scope: DealScope): Promise<void> {
  const store = useDealStore.getState();
  store.setDashboardLoading(scope);

  try {
    const dashboard = await getDashboardData(scope);

    if (useDealStore.getState().dashboardScope === scope) {
      useDealStore.getState().setDashboard(dashboard);
    }
  } catch {
    if (useDealStore.getState().dashboardScope === scope) {
      useDealStore.getState().setDashboardError();
    }
  }
}

async function sendInOrder(
  deal: Deal,
  send: (expectedVersion: number) => Promise<DealUpdateResult>
): Promise<DealUpdateResult> {
  try {
    return await dealWriter.write(deal.id, deal.version, send);
  } catch {
    return {
      status: "failed",
      id: deal.id,
      message: "Network error. The change was not saved.",
      retryable: true,
    };
  }
}

export async function moveDeal(
  dealId: string,
  targetStage: DealStage,
  mode: "move" | "undo" = "move"
): Promise<void> {
  const store = useDealStore.getState();
  const deal = store.dealsById[dealId];

  if (!deal) {
    return;
  }

  const currentSave = store.saves[dealId];

  if (currentSave?.kind === "bulk") {
    showToast({
      tone: "info",
      message: "This deal is part of a bulk move that is still running.",
      actions: [],
      sticky: false,
    });
    return;
  }

  const shownStage =
    currentSave?.kind === "saving" ? currentSave.targetStage : deal.stage;

  if (shownStage === targetStage) {
    if (currentSave && currentSave.kind !== "saving") {
      store.setSave(dealId, null);
    }
    return;
  }

  const toastKey = `deal:${dealId}`;
  const label = describeDeal(deal);

  nextSaveToken += 1;
  const token = nextSaveToken;

  useToastStore.getState().dismissKey(toastKey);
  store.setSave(dealId, { kind: "saving", targetStage, token });

  const result = await sendInOrder(deal, (expectedVersion) =>
    updateDealStage({ id: dealId, newStage: targetStage, expectedVersion })
  );

  const after = useDealStore.getState();
  const latestSave = after.saves[dealId];
  const isLatestMove =
    latestSave?.kind === "saving" && latestSave.token === token;

  if (result.status === "success") {
    const serverStageBefore = after.dealsById[dealId]?.stage ?? deal.stage;

    after.upsertDeals([result.deal]);
    syncSelectionWithOwnSave(result.deal);
    recordStageChangeInDashboard(result.deal, serverStageBefore, targetStage);

    if (isLatestMove) {
      after.setSave(dealId, null);
    }

    if (mode === "undo") {
      showToast({
        key: toastKey,
        tone: "info",
        message: `Undone. ${label} is back in ${targetStage}.`,
        actions: [],
        sticky: false,
      });
      return;
    }

    const undo = () => void moveDeal(dealId, shownStage, "undo");

    useToastStore.getState().setLastUndo({
      label: `Move ${label} back to ${shownStage}`,
      run: undo,
    });

    showToast({
      key: toastKey,
      tone: "success",
      message: `Moved ${label} to ${targetStage}.`,
      actions: [{ label: "Undo", run: undo }],
      sticky: false,
    });
    return;
  }

  if (result.status === "conflict") {
    after.upsertDeals([result.latestDeal]);

    if (!isLatestMove) {
      return;
    }

    if (result.latestDeal.stage === targetStage) {
      after.setSave(dealId, null);
      showToast({
        key: toastKey,
        tone: "info",
        message: `${displayName(result.latestDeal.updatedBy)} already moved ${label} to ${targetStage}.`,
        actions: [],
        sticky: false,
      });
      return;
    }

    after.setSave(dealId, {
      kind: "conflict",
      targetStage,
      changedBy: result.latestDeal.updatedBy,
      theirStage: result.latestDeal.stage,
    });

    showToast({
      key: toastKey,
      tone: "warning",
      message: `${displayName(result.latestDeal.updatedBy)} changed ${label} to ${result.latestDeal.stage} before your save landed. Your ${mode === "undo" ? "undo" : `move to ${targetStage}`} was not applied.`,
      actions: [
        { label: "Apply mine", run: () => void moveDeal(dealId, targetStage, mode) },
        { label: "Keep theirs", run: () => dismissSaveProblem(dealId) },
      ],
      sticky: true,
    });
    return;
  }

  if (!isLatestMove) {
    return;
  }

  after.setSave(dealId, {
    kind: "failed",
    targetStage,
    message: result.message,
    retryable: result.retryable,
  });

  showToast({
    key: toastKey,
    tone: "error",
    message: `Not saved: ${label} is still in ${after.dealsById[dealId]?.stage ?? deal.stage}. ${result.message}`,
    actions: result.retryable
      ? [{ label: "Retry", run: () => void moveDeal(dealId, targetStage, mode) }]
      : [],
    sticky: true,
  });
}

export function retrySave(dealId: string): void {
  const save = useDealStore.getState().saves[dealId];

  if (save?.kind === "failed" || save?.kind === "conflict") {
    void moveDeal(dealId, save.targetStage);
  }
}

export function dismissSaveProblem(dealId: string): void {
  useDealStore.getState().setSave(dealId, null);
  useToastStore.getState().dismissKey(`deal:${dealId}`);
}

export async function saveFollowUp(
  dealId: string,
  nextFollowUpAt: string
): Promise<DealUpdateResult | null> {
  const deal = useDealStore.getState().dealsById[dealId];

  if (!deal) {
    return null;
  }

  const result = await sendInOrder(deal, (expectedVersion) =>
    updateDealFollowUp({ id: dealId, nextFollowUpAt, expectedVersion })
  );

  const store = useDealStore.getState();

  if (result.status === "success") {
    store.upsertDeals([result.deal]);
    syncSelectionWithOwnSave(result.deal);
    void loadDashboard(store.dashboardScope);
  } else if (result.status === "conflict") {
    store.upsertDeals([result.latestDeal]);
  }

  return result;
}

export async function addNote(
  dealId: string,
  text: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const deal = await addDealNote(dealId, text);
    useDealStore.getState().upsertDeals([deal]);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "The note was not saved.",
    };
  }
}
