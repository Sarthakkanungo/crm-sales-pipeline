import { showToast } from "../../../shared/toastStore";
import { rowIdsBetween } from "../logic/rowBatches";
import { simulateTeammateEdit } from "../services/dealService";
import { useDealStore } from "../store/dealStore";

function getOnScreenIds(): string[] {
  const { batches, visibleRange } = useDealStore.getState();

  return rowIdsBetween(batches, visibleRange.first, visibleRange.last);
}

function scrollToRow(dealId: string): void {
  const row = document.querySelector<HTMLElement>(`[data-deal-id="${dealId}"]`);

  row?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function simulateTeammateEditWithFeedback(dealId: string): void {
  const deal = simulateTeammateEdit(dealId);

  if (!deal) {
    return;
  }

  const isOnScreen = getOnScreenIds().includes(dealId);

  showToast({
    key: "simulation",
    tone: "info",
    message: `Simulated: ${deal.updatedBy} moved ${deal.companyName} · ${deal.name} to ${deal.stage}.`,
    actions: isOnScreen ? [{ label: "Show row", run: () => scrollToRow(dealId) }] : [],
    sticky: false,
  });
}

export function simulateEditOnVisibleDeal(): void {
  const onScreen = getOnScreenIds();

  if (onScreen.length === 0) {
    showToast({
      tone: "info",
      message: "No deals on screen to edit. Clear the filters first.",
      actions: [],
      sticky: false,
    });
    return;
  }

  simulateTeammateEditWithFeedback(onScreen[Math.floor(Math.random() * onScreen.length)]);
}
