import { describe, expect, it } from "vitest";
import type { Deal, DealQuery, DealStage } from "../types/deal.types";
import { queryDeals } from "./dealQuery";
import { createQueryEngine } from "./queryEngine";

const NOW = new Date(2026, 10, 22, 12, 0, 0);
const STAGES: DealStage[] = ["New Lead", "Negotiation", "Lost"];

function makeDeals(count: number): Deal[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `deal-${index + 1}`,
    name: index % 2 ? "Fleet Tracking" : "EV Charging",
    companyName: index % 3 ? "Acme" : "Globex",
    licenceCount: 10,
    value: (index * 7919) % 1000,
    currency: "INR" as const,
    ownerName: index % 4 ? "Rahul Sharma" : "Priya Singh",
    stage: STAGES[index % STAGES.length],
    closeDate: null,
    notes: [],
    nextFollowUpAt:
      index % 5 ? new Date(NOW.getTime() + (index - 50) * 3600 * 1000).toISOString() : null,
    updatedAt: new Date(NOW.getTime() - index * 60000).toISOString(),
    updatedBy: "Rahul Sharma",
    version: 1,
  }));
}

function setup(count = 120) {
  const deals = makeDeals(count);
  const byId = new Map(deals.map((deal) => [deal.id, deal]));
  const engine = createQueryEngine(deals, byId);
  return { deals, byId, engine };
}

const baseQuery: DealQuery = {
  search: "",
  stage: null,
  scope: "all",
  quickFilter: null,
  sortKey: "value",
  sortDirection: "desc",
};

const ids = (deals: readonly Deal[]) => deals.map((deal) => deal.id);

describe("createQueryEngine", () => {
  it("returns exactly what a plain full scan returns", () => {
    const { deals, engine } = setup();
    const queries: DealQuery[] = [
      baseQuery,
      { ...baseQuery, stage: "Negotiation" },
      { ...baseQuery, scope: "mine", sortKey: "nextFollowUpAt", sortDirection: "asc" },
      { ...baseQuery, search: "acme", sortKey: "updatedAt" },
      { ...baseQuery, quickFilter: "overdue", sortKey: "nextFollowUpAt", sortDirection: "asc" },
      { ...baseQuery, stage: "Lost", quickFilter: "updatedToday" },
    ];

    for (const query of queries) {
      expect(ids(engine.run(query, "Rahul Sharma", NOW))).toEqual(
        ids(queryDeals(deals, query, "Rahul Sharma", NOW))
      );
    }
  });

  it("serves a repeated query from the cache", () => {
    const { engine } = setup();

    const first = engine.run(baseQuery, "Rahul Sharma", NOW);
    const second = engine.run(baseQuery, "Rahul Sharma", NOW);

    expect(second).toBe(first);
  });

  it("recomputes after any deal changes, so results are never stale", () => {
    const { byId, engine } = setup();
    const query = { ...baseQuery, stage: "Negotiation" as DealStage };
    const before = engine.run(query, "Rahul Sharma", NOW);

    const deal = byId.get(before[0].id)!;
    deal.stage = "Lost";
    deal.version += 1;
    engine.recordChange(deal, "Negotiation");

    const after = engine.run(query, "Rahul Sharma", NOW);

    expect(after).not.toBe(before);
    expect(ids(after)).not.toContain(deal.id);
    expect(ids(engine.run({ ...baseQuery, stage: "Lost" }, "Rahul Sharma", NOW))).toContain(
      deal.id
    );
  });

  it("uses fresh dates after a deal is updated", () => {
    const { byId, engine } = setup();
    const query = { ...baseQuery, sortKey: "updatedAt" as const, sortDirection: "desc" as const };
    const deal = byId.get("deal-100")!;

    deal.updatedAt = new Date(NOW.getTime() + 60000).toISOString();
    engine.recordChange(deal, deal.stage);

    expect(engine.run(query, "Rahul Sharma", NOW)[0].id).toBe("deal-100");
  });

  it("keeps only a limited number of cached queries", () => {
    const deals = makeDeals(20);
    const engine = createQueryEngine(deals, new Map(deals.map((d) => [d.id, d])), 3);

    for (const search of ["a", "b", "c", "d", "e"]) {
      engine.run({ ...baseQuery, search }, "Rahul Sharma", NOW);
    }

    expect(engine.cacheSize()).toBe(3);
  });
});
