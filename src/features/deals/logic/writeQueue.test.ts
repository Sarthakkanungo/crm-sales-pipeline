import { describe, expect, it } from "vitest";
import type { Deal, DealUpdateResult } from "../types/deal.types";
import {
  createKeyedQueue,
  createOrderedDealWriter,
  followOwnWrites,
} from "./writeQueue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeDeal(version: number): Deal {
  return {
    id: "deal-1",
    name: "Fleet",
    companyName: "Acme",
    licenceCount: 10,
    value: 100,
    currency: "INR",
    ownerName: "Rahul Sharma",
    stage: "New Lead",
    closeDate: null,
    notes: [],
    nextFollowUpAt: null,
    updatedAt: new Date().toISOString(),
    updatedBy: "Rahul Sharma",
    version,
  };
}

describe("createKeyedQueue", () => {
  it("runs tasks for the same key one after another", async () => {
    const queue = createKeyedQueue();
    const order: string[] = [];
    const first = deferred<void>();

    const a = queue.run("deal-1", async () => {
      order.push("a:start");
      await first.promise;
      order.push("a:end");
    });
    const b = queue.run("deal-1", async () => {
      order.push("b:start");
    });

    await Promise.resolve();
    expect(order).toEqual(["a:start"]);

    first.resolve();
    await Promise.all([a, b]);

    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("runs tasks for different keys in parallel", async () => {
    const queue = createKeyedQueue();
    const blocker = deferred<void>();
    let otherRan = false;

    void queue.run("deal-1", () => blocker.promise);
    await queue.run("deal-2", async () => {
      otherRan = true;
    });

    expect(otherRan).toBe(true);
    blocker.resolve();
  });

  it("keeps going after a task fails", async () => {
    const queue = createKeyedQueue();

    await expect(
      queue.run("deal-1", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    await expect(queue.run("deal-1", async () => "next")).resolves.toBe("next");
  });

  it("forgets keys once their work is done", async () => {
    const queue = createKeyedQueue();

    await queue.run("deal-1", async () => undefined);
    await Promise.resolve();

    expect(queue.pendingKeys()).toBe(0);
  });
});

describe("followOwnWrites", () => {
  it("returns the seen version when we have not written", () => {
    expect(followOwnWrites(3, undefined)).toBe(3);
  });

  it("follows a chain of our own successful writes", () => {
    const writes = new Map([
      [1, 2],
      [2, 3],
    ]);

    expect(followOwnWrites(1, writes)).toBe(3);
  });

  it("does not skip over a version written by someone else", () => {
    const writes = new Map([[1, 2]]);

    expect(followOwnWrites(5, writes)).toBe(5);
  });
});

describe("createOrderedDealWriter", () => {
  it("sends a quick second move with the version from the first save", async () => {
    const writer = createOrderedDealWriter();
    const sentVersions: number[] = [];
    let serverVersion = 1;

    const send = async (expectedVersion: number): Promise<DealUpdateResult> => {
      sentVersions.push(expectedVersion);

      if (expectedVersion !== serverVersion) {
        return {
          status: "conflict",
          id: "deal-1",
          latestDeal: fakeDeal(serverVersion),
          message: "conflict",
        };
      }

      serverVersion += 1;
      return { status: "success", deal: fakeDeal(serverVersion) };
    };

    const [first, second, third] = await Promise.all([
      writer.write("deal-1", 1, send),
      writer.write("deal-1", 1, send),
      writer.write("deal-1", 1, send),
    ]);

    expect(sentVersions).toEqual([1, 2, 3]);
    expect([first.status, second.status, third.status]).toEqual([
      "success",
      "success",
      "success",
    ]);
  });

  it("still reports a conflict when a teammate changed the deal", async () => {
    const writer = createOrderedDealWriter();

    const result = await writer.write("deal-1", 1, async () => ({
      status: "conflict",
      id: "deal-1",
      latestDeal: fakeDeal(2),
      message: "conflict",
    }));

    expect(result.status).toBe("conflict");
  });

  it("does not trust a failed save as a new base version", async () => {
    const writer = createOrderedDealWriter();
    const sentVersions: number[] = [];

    await writer.write("deal-1", 1, async (version) => {
      sentVersions.push(version);
      return { status: "failed", id: "deal-1", message: "down", retryable: true };
    });

    await writer.write("deal-1", 1, async (version) => {
      sentVersions.push(version);
      return { status: "success", deal: fakeDeal(2) };
    });

    expect(sentVersions).toEqual([1, 1]);
  });
});
