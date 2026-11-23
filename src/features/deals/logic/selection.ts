import type { Deal, DealQuery, DealStage } from "../types/deal.types";

export interface SelectedDeal {
  version: number;
  stage: DealStage;
  name: string;
  companyName: string;
}

function rememberDeal(deal: Deal): SelectedDeal {
  return {
    version: deal.version,
    stage: deal.stage,
    name: deal.name,
    companyName: deal.companyName,
  };
}

export type Selection =
  | { mode: "ids"; items: Record<string, SelectedDeal> }
  | {
      mode: "query";
      query: DealQuery;
      total: number;
      excluded: Record<string, true>;
    };

export const EMPTY_SELECTION: Selection = { mode: "ids", items: {} };

export function isSelected(selection: Selection, dealId: string): boolean {
  return selection.mode === "ids"
    ? dealId in selection.items
    : !(dealId in selection.excluded);
}

export function selectionCount(selection: Selection): number {
  if (selection.mode === "ids") {
    return Object.keys(selection.items).length;
  }

  return Math.max(0, selection.total - Object.keys(selection.excluded).length);
}

export function setDealsSelected(
  selection: Selection,
  deals: readonly Deal[],
  selected: boolean
): Selection {
  if (selection.mode === "ids") {
    const items = { ...selection.items };

    for (const deal of deals) {
      if (selected) {
        items[deal.id] = rememberDeal(deal);
      } else {
        delete items[deal.id];
      }
    }

    return { mode: "ids", items };
  }

  const excluded = { ...selection.excluded };

  for (const deal of deals) {
    if (selected) {
      delete excluded[deal.id];
    } else {
      excluded[deal.id] = true;
    }
  }

  return { ...selection, excluded };
}

export function toggleDealSelected(selection: Selection, deal: Deal): Selection {
  return setDealsSelected(selection, [deal], !isSelected(selection, deal.id));
}

export function selectAllMatching(query: DealQuery, total: number): Selection {
  return { mode: "query", query, total, excluded: {} };
}

export function syncSelectedDeal(selection: Selection, deal: Deal): Selection {
  if (selection.mode !== "ids") {
    return selection;
  }

  const current = selection.items[deal.id];

  if (
    !current ||
    (current.version === deal.version && current.stage === deal.stage)
  ) {
    return selection;
  }

  return {
    mode: "ids",
    items: {
      ...selection.items,
      [deal.id]: rememberDeal(deal),
    },
  };
}
