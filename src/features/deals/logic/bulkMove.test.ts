import { describe, expect, it } from "vitest";
import type {
  Deal,
  DealStage,
  DealUpdateRequest,
  DealUpdateResult,
} from "../types/deal.types";
import { runBulkMove, splitIntoChunks, type BulkRequest } from "./bulkMove";

function makeDeal(id: string, stage: DealStage, version: number): Deal {
  return {
    id,
    name: "Fleet",
    companyName: "Acme",
    licenceCount: 10,
    value: 100,
    currency: "INR",
    ownerName: "Rahul Sharma",
    stage,
    closeDate: null,
    notes: [],
    nextFollowUpAt: null,
    updatedAt: new Date().toISOString(),
    updatedBy: "Priya Singh",
    version,
  };
}

function makeRequests(count: number): BulkRequest[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `deal-${index + 1}`,
    name: "Fleet",
    companyName: "Acme",
    fromStage: "Negotiation",
    newStage: "Lost",
    expectedVersion: 1,
  }));
}

describe("splitIntoChunks", () => {
  it("splits items into equal chunks with a smaller last chunk", () => {
    expect(splitIntoChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("runBulkMove", () => {
  it("sorts every result into saved, failed and conflicts", async () => {
    const send = async (
      requests: DealUpdateRequest[]
    ): Promise<DealUpdateResult[]> =>
      requests.map((request, index) => {
        if (index % 3 === 0) {
          return { status: "success", deal: makeDeal(request.id, "Lost", 2) };
        }

        if (index % 3 === 1) {
          return {
            status: "failed",
            id: request.id,
            message: "down",
            retryable: true,
          };
        }

        return {
          status: "conflict",
          id: request.id,
          latestDeal: makeDeal(request.id, "Won", 2),
          message: "changed",
        };
      });

    const outcome = await runBulkMove(makeRequests(9), { send, chunkSize: 3 });

    expect(outcome.saved).toHaveLength(3);
    expect(outcome.failed).toHaveLength(3);
    expect(outcome.conflicts).toHaveLength(3);
    expect(outcome.notAttempted).toHaveLength(0);
  });

  it("treats a conflict that already reached the target stage as done", async () => {
    const send = async (
      requests: DealUpdateRequest[]
    ): Promise<DealUpdateResult[]> =>
      requests.map((request) => ({
        status: "conflict",
        id: request.id,
        latestDeal: makeDeal(request.id, "Lost", 5),
        message: "changed",
      }));

    const outcome = await runBulkMove(makeRequests(2), { send });

    expect(outcome.alreadyInTarget).toHaveLength(2);
    expect(outcome.conflicts).toHaveLength(0);
  });

  it("marks a whole chunk as failed when the request throws", async () => {
    let call = 0;
    const send = async (
      requests: DealUpdateRequest[]
    ): Promise<DealUpdateResult[]> => {
      call += 1;

      if (call === 1) {
        throw new Error("network down");
      }

      return requests.map((request) => ({
        status: "success",
        deal: makeDeal(request.id, "Lost", 2),
      }));
    };

    const outcome = await runBulkMove(makeRequests(4), {
      send,
      chunkSize: 2,
      concurrency: 1,
    });

    expect(outcome.failed.map((item) => item.request.id)).toEqual([
      "deal-1",
      "deal-2",
    ]);
    expect(outcome.saved.map((item) => item.deal.id)).toEqual([
      "deal-3",
      "deal-4",
    ]);
  });

  it("reports progress after every chunk", async () => {
    const progress: number[] = [];
    const send = async (
      requests: DealUpdateRequest[]
    ): Promise<DealUpdateResult[]> =>
      requests.map((request) => ({
        status: "success",
        deal: makeDeal(request.id, "Lost", 2),
      }));

    await runBulkMove(makeRequests(5), {
      send,
      chunkSize: 2,
      concurrency: 1,
      onChunk: (_, value) => progress.push(value.processed),
    });

    expect(progress).toEqual([2, 4, 5]);
  });

  it("stops sending new chunks after cancel and lists what was not sent", async () => {
    const controller = new AbortController();
    const send = async (
      requests: DealUpdateRequest[]
    ): Promise<DealUpdateResult[]> => {
      controller.abort();

      return requests.map((request) => ({
        status: "success",
        deal: makeDeal(request.id, "Lost", 2),
      }));
    };

    const outcome = await runBulkMove(makeRequests(6), {
      send,
      chunkSize: 2,
      concurrency: 1,
      signal: controller.signal,
    });

    expect(outcome.saved).toHaveLength(2);
    expect(outcome.notAttempted).toHaveLength(4);
  });

  it("never sends more chunks at once than the concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const send = async (
      requests: DealUpdateRequest[]
    ): Promise<DealUpdateResult[]> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;

      return requests.map((request) => ({
        status: "success",
        deal: makeDeal(request.id, "Lost", 2),
      }));
    };

    await runBulkMove(makeRequests(20), { send, chunkSize: 2, concurrency: 3 });

    expect(maxInFlight).toBe(3);
  });
});
