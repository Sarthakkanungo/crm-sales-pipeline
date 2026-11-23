import { describe, expect, it } from "vitest";
import type { Deal, DealQuery } from "../types/deal.types";
import {
  EMPTY_SELECTION,
  isSelected,
  selectAllMatching,
  selectionCount,
  setDealsSelected,
  syncSelectedDeal,
  toggleDealSelected,
} from "./selection";

function makeDeal(id: string, version = 1): Deal {
  return {
    id,
    name: "Fleet",
    companyName: "Acme",
    licenceCount: 10,
    value: 100,
    currency: "INR",
    ownerName: "Rahul Sharma",
    stage: "Contacted",
    closeDate: null,
    notes: [],
    nextFollowUpAt: null,
    updatedAt: new Date().toISOString(),
    updatedBy: "Rahul Sharma",
    version,
  };
}

const query: DealQuery = {
  search: "",
  stage: "Negotiation",
  scope: "all",
  quickFilter: null,
  sortKey: "value",
  sortDirection: "desc",
};

describe("selection by ids", () => {
  it("toggles a deal on and off", () => {
    const deal = makeDeal("deal-1");
    const selected = toggleDealSelected(EMPTY_SELECTION, deal);

    expect(isSelected(selected, "deal-1")).toBe(true);
    expect(isSelected(toggleDealSelected(selected, deal), "deal-1")).toBe(false);
  });

  it("keeps deals from other pages when a new page is selected", () => {
    const firstPage = setDealsSelected(EMPTY_SELECTION, [makeDeal("deal-1")], true);
    const bothPages = setDealsSelected(firstPage, [makeDeal("deal-51")], true);

    expect(selectionCount(bothPages)).toBe(2);
  });

  it("remembers the version the user saw when selecting", () => {
    const selected = setDealsSelected(EMPTY_SELECTION, [makeDeal("deal-1", 4)], true);

    expect(selected.mode === "ids" && selected.items["deal-1"].version).toBe(4);
  });

  it("updates the remembered version after our own save", () => {
    const selected = setDealsSelected(EMPTY_SELECTION, [makeDeal("deal-1", 1)], true);
    const synced = syncSelectedDeal(selected, makeDeal("deal-1", 2));

    expect(synced.mode === "ids" && synced.items["deal-1"].version).toBe(2);
  });

  it("ignores deals that are not selected when syncing", () => {
    const synced = syncSelectedDeal(EMPTY_SELECTION, makeDeal("deal-9", 2));

    expect(synced).toBe(EMPTY_SELECTION);
  });
});

describe("selection of everything in a view", () => {
  it("counts every matching deal minus the ones the user unticked", () => {
    const all = selectAllMatching(query, 8412);
    const withExclusion = toggleDealSelected(all, makeDeal("deal-7"));

    expect(selectionCount(all)).toBe(8412);
    expect(selectionCount(withExclusion)).toBe(8411);
    expect(isSelected(withExclusion, "deal-7")).toBe(false);
    expect(isSelected(withExclusion, "deal-8")).toBe(true);
  });

  it("can re-include a deal that was excluded", () => {
    const excluded = toggleDealSelected(selectAllMatching(query, 10), makeDeal("deal-1"));
    const included = toggleDealSelected(excluded, makeDeal("deal-1"));

    expect(selectionCount(included)).toBe(10);
  });
});
