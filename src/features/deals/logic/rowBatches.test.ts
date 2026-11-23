import { describe, expect, it } from "vitest";
import {
  BATCH_SIZE,
  batchCount,
  batchesNeeded,
  batchesToDrop,
  batchOf,
  rowIdAt,
  rowIdsBetween,
} from "./rowBatches";

describe("batchOf / batchCount", () => {
  it("puts rows 0-199 in batch 0 and row 200 in batch 1", () => {
    expect(batchOf(0)).toBe(0);
    expect(batchOf(BATCH_SIZE - 1)).toBe(0);
    expect(batchOf(BATCH_SIZE)).toBe(1);
  });

  it("counts a partial last batch", () => {
    expect(batchCount(1235)).toBe(7);
    expect(batchCount(0)).toBe(0);
  });
});

describe("batchesNeeded", () => {
  it("loads only the batch on screen when far from its edges", () => {
    expect(batchesNeeded(80, 95, 1235)).toEqual([0]);
  });

  it("loads the next batch before the user reaches it", () => {
    expect(batchesNeeded(170, 185, 1235)).toEqual([0, 1]);
  });

  it("also loads the previous batch when scrolling up near an edge", () => {
    expect(batchesNeeded(205, 220, 1235)).toEqual([0, 1]);
  });

  it("never asks for batches past the end", () => {
    expect(batchesNeeded(1220, 1234, 1235)).toEqual([5, 6]);
  });

  it("asks for nothing when the view is empty", () => {
    expect(batchesNeeded(0, 0, 0)).toEqual([]);
  });
});

describe("batchesToDrop", () => {
  it("drops batches far away from what is on screen", () => {
    expect(batchesToDrop([0, 1, 2, 3, 4, 5, 6, 7], 1000, 1015)).toEqual([0, 1, 2]);
  });

  it("keeps nearby batches so scrolling back is instant", () => {
    expect(batchesToDrop([3, 4, 5, 6, 7], 1000, 1015)).toEqual([]);
  });
});

describe("rowIdAt / rowIdsBetween", () => {
  const batches = {
    0: Array.from({ length: BATCH_SIZE }, (_, index) => `deal-${index}`),
    2: ["deal-a", "deal-b"],
  };

  it("finds a row inside a loaded batch", () => {
    expect(rowIdAt(batches, 5)).toBe("deal-5");
    expect(rowIdAt(batches, 2 * BATCH_SIZE + 1)).toBe("deal-b");
  });

  it("returns nothing for a row that is not loaded yet", () => {
    expect(rowIdAt(batches, BATCH_SIZE + 3)).toBeUndefined();
  });

  it("collects only loaded rows in a range", () => {
    expect(rowIdsBetween(batches, BATCH_SIZE - 2, 2 * BATCH_SIZE)).toEqual([
      "deal-198",
      "deal-199",
      "deal-a",
    ]);
  });
});
