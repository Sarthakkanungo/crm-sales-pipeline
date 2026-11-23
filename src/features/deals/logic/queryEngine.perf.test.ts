import { describe, expect, it } from "vitest";
import { generateDeals } from "../../../mock/generateDeals";
import type { DealQuery } from "../types/deal.types";
import { queryDeals } from "./dealQuery";
import { createQueryEngine } from "./queryEngine";

interface Measurement {
  what: string;
  medianMs: number;
  worstMs: number;
}

function measure(what: string, work: () => void, runs = 25): Measurement {
  work();

  const times: number[] = [];

  for (let run = 0; run < runs; run += 1) {
    const start = performance.now();
    work();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);

  return {
    what,
    medianMs: Number(times[Math.floor(runs / 2)].toFixed(2)),
    worstMs: Number(times[runs - 1].toFixed(2)),
  };
}

const deals = generateDeals(50000);
const dealsById = new Map(deals.map((deal) => [deal.id, deal]));
const engine = createQueryEngine(deals, dealsById);
const now = new Date();
const user = "Rahul Sharma";

const allByUpdated: DealQuery = {
  search: "",
  stage: null,
  scope: "all",
  quickFilter: null,
  sortKey: "updatedAt",
  sortDirection: "desc",
};

const negotiationByValue: DealQuery = {
  ...allByUpdated,
  stage: "Negotiation",
  sortKey: "value",
};

function clearCache(): void {
  engine.recordChange(deals[0], deals[0].stage);
}

describe("query speed with 50,000 deals", () => {
  it("measures the plain scan against the query engine", () => {
    const results = [
      measure("All deals by last updated: plain full scan (before)", () => {
        queryDeals(deals, allByUpdated, user, now);
      }),
      measure("All deals by last updated: engine, cache empty", () => {
        clearCache();
        engine.run(allByUpdated, user, now);
      }),
      measure("All deals by last updated: engine, cache hit (next page)", () => {
        engine.run(allByUpdated, user, now);
      }),
      measure("Negotiation by value: plain full scan (before)", () => {
        queryDeals(deals, negotiationByValue, user, now);
      }),
      measure("Negotiation by value: engine with stage index", () => {
        clearCache();
        engine.run(negotiationByValue, user, now);
      }),
    ];

    console.table(results);

    expect(engine.run(allByUpdated, user, now).map((deal) => deal.id)).toEqual(
      queryDeals(deals, allByUpdated, user, now).map((deal) => deal.id)
    );
  });
});
