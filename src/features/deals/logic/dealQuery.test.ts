import { describe, expect, it } from "vitest";
import type { Deal, DealQuery } from "../types/deal.types";
import { applyStageChange, buildDashboard, countViewTabs } from "./dashboard";
import {
  createDealMatcher,
  getFollowUpBucket,
  resolveFilterConflict,
  sortDeals,
} from "./dealQuery";

const NOW = new Date(2026, 10, 22, 12, 0, 0);

function hoursFromNow(hours: number): string {
  return new Date(NOW.getTime() + hours * 3600 * 1000).toISOString();
}

function makeDeal(overrides: Partial<Deal>): Deal {
  return {
    id: "deal-1",
    name: "Fleet Tracking",
    companyName: "Acme Logistics",
    licenceCount: 10,
    value: 100,
    currency: "INR",
    ownerName: "Rahul Sharma",
    stage: "Contacted",
    closeDate: null,
    notes: [],
    nextFollowUpAt: null,
    updatedAt: hoursFromNow(-48),
    updatedBy: "Rahul Sharma",
    version: 1,
    ...overrides,
  };
}

const baseQuery: DealQuery = {
  search: "",
  stage: null,
  scope: "mine",
  quickFilter: null,
  sortKey: "nextFollowUpAt",
  sortDirection: "asc",
};

describe("createDealMatcher", () => {
  it("only shows my deals in my scope", () => {
    const matches = createDealMatcher(baseQuery, "Rahul Sharma", NOW);

    expect(matches(makeDeal({}))).toBe(true);
    expect(matches(makeDeal({ ownerName: "Priya Singh" }))).toBe(false);
  });

  it("shows everyone's deals in team scope", () => {
    const matches = createDealMatcher({ ...baseQuery, scope: "all" }, "Rahul Sharma", NOW);

    expect(matches(makeDeal({ ownerName: "Priya Singh" }))).toBe(true);
  });

  it("searches deal and company names without caring about case", () => {
    const matches = createDealMatcher({ ...baseQuery, search: "ACME" }, "Rahul Sharma", NOW);

    expect(matches(makeDeal({}))).toBe(true);
    expect(matches(makeDeal({ companyName: "Other", name: "Other" }))).toBe(false);
  });

  it("finds a deal by its exact ID without matching longer IDs", () => {
    const matches = createDealMatcher({ ...baseQuery, search: " DEAL-23 " }, "Rahul Sharma", NOW);

    expect(matches(makeDeal({ id: "deal-23", name: "Other", companyName: "Other" }))).toBe(true);
    expect(matches(makeDeal({ id: "deal-230", name: "Other", companyName: "Other" }))).toBe(false);
  });

  it("finds overdue follow-ups on open deals only", () => {
    const matches = createDealMatcher(
      { ...baseQuery, quickFilter: "overdue" },
      "Rahul Sharma",
      NOW
    );

    expect(matches(makeDeal({ nextFollowUpAt: hoursFromNow(-30) }))).toBe(true);
    expect(matches(makeDeal({ nextFollowUpAt: hoursFromNow(-30), stage: "Lost" }))).toBe(
      false
    );
    expect(matches(makeDeal({ nextFollowUpAt: hoursFromNow(1) }))).toBe(false);
  });

  it("finds deals updated today", () => {
    const matches = createDealMatcher(
      { ...baseQuery, quickFilter: "updatedToday" },
      "Rahul Sharma",
      NOW
    );

    expect(matches(makeDeal({ updatedAt: hoursFromNow(-1) }))).toBe(true);
    expect(matches(makeDeal({ updatedAt: hoursFromNow(-48) }))).toBe(false);
  });
});

describe("getFollowUpBucket", () => {
  it("puts earlier today in due today, not overdue", () => {
    expect(getFollowUpBucket(makeDeal({ nextFollowUpAt: hoursFromNow(-2) }), NOW)).toBe(
      "dueToday"
    );
  });

  it("ignores follow-ups on closed deals", () => {
    expect(
      getFollowUpBucket(makeDeal({ nextFollowUpAt: hoursFromNow(-30), stage: "Won" }), NOW)
    ).toBe("none");
  });
});

describe("sortDeals", () => {
  it("puts deals without a follow-up last in both directions", () => {
    const deals = [
      makeDeal({ id: "deal-1", nextFollowUpAt: null }),
      makeDeal({ id: "deal-2", nextFollowUpAt: hoursFromNow(5) }),
      makeDeal({ id: "deal-3", nextFollowUpAt: hoursFromNow(-5) }),
    ];

    expect(sortDeals(deals, "nextFollowUpAt", "asc").map((d) => d.id)).toEqual([
      "deal-3",
      "deal-2",
      "deal-1",
    ]);
    expect(sortDeals(deals, "nextFollowUpAt", "desc").map((d) => d.id)).toEqual([
      "deal-2",
      "deal-3",
      "deal-1",
    ]);
  });

  it("keeps a stable order for equal values", () => {
    const deals = [
      makeDeal({ id: "deal-10", value: 5 }),
      makeDeal({ id: "deal-2", value: 5 }),
    ];

    expect(sortDeals(deals, "value", "desc").map((d) => d.id)).toEqual([
      "deal-2",
      "deal-10",
    ]);
  });
});

describe("dashboard", () => {
  it("counts stages, active deals and follow-ups", () => {
    const dashboard = buildDashboard(
      [
        makeDeal({ id: "deal-1", nextFollowUpAt: hoursFromNow(-30) }),
        makeDeal({ id: "deal-2", nextFollowUpAt: hoursFromNow(1) }),
        makeDeal({ id: "deal-3", stage: "Won" }),
      ],
      NOW
    );

    expect(dashboard.activeDeals).toBe(2);
    expect(dashboard.overdue).toBe(1);
    expect(dashboard.dueToday).toBe(1);
    expect(dashboard.wonDeals).toBe(1);
    expect(dashboard.stageCounts.Contacted).toBe(2);
  });

  it("updates counts locally when an overdue deal is moved to Lost", () => {
    const overdueDeal = makeDeal({ id: "deal-1", nextFollowUpAt: hoursFromNow(-30) });
    const dashboard = buildDashboard([overdueDeal], NOW);
    const updated = applyStageChange(
      dashboard,
      { ...overdueDeal, stage: "Lost" },
      "Contacted",
      "Lost",
      NOW
    );

    expect(updated.stageCounts.Contacted).toBe(0);
    expect(updated.stageCounts.Lost).toBe(1);
    expect(updated.activeDeals).toBe(0);
    expect(updated.overdue).toBe(0);
  });

  it("adds up deal value for every tile and stage", () => {
    const dashboard = buildDashboard(
      [
        makeDeal({ id: "deal-1", value: 500, nextFollowUpAt: hoursFromNow(-30) }),
        makeDeal({ id: "deal-2", value: 300, nextFollowUpAt: hoursFromNow(1) }),
        makeDeal({ id: "deal-3", value: 900, stage: "Won" }),
      ],
      NOW
    );

    expect(dashboard.overdueValue).toBe(500);
    expect(dashboard.dueTodayValue).toBe(300);
    expect(dashboard.activeValue).toBe(800);
    expect(dashboard.stageValues.Won).toBe(900);
    expect(dashboard.stageValues.Contacted).toBe(800);
  });

  it("moves the value with the deal when its stage changes", () => {
    const overdueDeal = makeDeal({ id: "deal-1", value: 500, nextFollowUpAt: hoursFromNow(-30) });
    const updated = applyStageChange(
      buildDashboard([overdueDeal], NOW),
      { ...overdueDeal, stage: "Won" },
      "Contacted",
      "Won",
      NOW
    );

    expect(updated.stageValues.Contacted).toBe(0);
    expect(updated.stageValues.Won).toBe(500);
    expect(updated.activeValue).toBe(0);
    expect(updated.overdueValue).toBe(0);
  });
});

describe("countViewTabs", () => {
  it("counts every tab in one pass, ignoring follow-ups on closed deals", () => {
    const counts = countViewTabs(
      [
        makeDeal({ id: "deal-1", nextFollowUpAt: hoursFromNow(-30) }),
        makeDeal({ id: "deal-2", nextFollowUpAt: hoursFromNow(-30), stage: "Lost" }),
        makeDeal({ id: "deal-3", nextFollowUpAt: hoursFromNow(1) }),
        makeDeal({ id: "deal-4", updatedAt: hoursFromNow(-1) }),
        makeDeal({ id: "deal-5", nextFollowUpAt: hoursFromNow(48) }),
      ],
      NOW
    );

    expect(counts).toEqual({ all: 5, active: 4, overdue: 1, dueToday: 1, updatedToday: 1 });
  });

  it("matches what each quick filter actually shows", () => {
    const deals = [
      makeDeal({ id: "deal-1", nextFollowUpAt: hoursFromNow(-30) }),
      makeDeal({ id: "deal-2", nextFollowUpAt: hoursFromNow(-3), updatedAt: hoursFromNow(-2) }),
      makeDeal({ id: "deal-3", nextFollowUpAt: hoursFromNow(-30), stage: "Won" }),
    ];
    const counts = countViewTabs(deals, NOW);
    const shown = (quickFilter: DealQuery["quickFilter"]) =>
      deals.filter(createDealMatcher({ ...baseQuery, quickFilter }, "Rahul Sharma", NOW)).length;

    expect(counts.active).toBe(shown("active"));
    expect(counts.overdue).toBe(shown("overdue"));
    expect(counts.dueToday).toBe(shown("dueToday"));
    expect(counts.updatedToday).toBe(shown("updatedToday"));
  });
});

describe("resolveFilterConflict", () => {
  it("drops an open-only view when a closed stage is chosen", () => {
    expect(resolveFilterConflict({ stage: "Won", quickFilter: "overdue" }, "stage")).toEqual({
      stage: "Won",
      quickFilter: null,
    });
  });

  it("drops the closed stage when an open-only view is chosen", () => {
    expect(resolveFilterConflict({ stage: "Lost", quickFilter: "active" }, "quickFilter")).toEqual({
      stage: null,
      quickFilter: "active",
    });
  });

  it("keeps combinations that can match deals", () => {
    const negotiationOverdue = { stage: "Negotiation" as const, quickFilter: "overdue" as const };
    const wonUpdatedToday = { stage: "Won" as const, quickFilter: "updatedToday" as const };

    expect(resolveFilterConflict(negotiationOverdue, "quickFilter")).toBe(negotiationOverdue);
    expect(resolveFilterConflict(wonUpdatedToday, "stage")).toBe(wonUpdatedToday);
  });
});
