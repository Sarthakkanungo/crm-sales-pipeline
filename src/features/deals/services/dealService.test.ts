import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockDeals } from "../../../mock/mockdatabase";
import type { DealChangeEvent, DealStage } from "../types/deal.types";
import {
  getDeals,
  simulateTeammateEdit,
  subscribeToDealChanges,
  updateDealStage,
  updateDealsStage,
} from "./dealService";
import { setRole } from "../../session/sessionStore";
import { DEFAULT_SIM_CONFIG, updateSimConfig } from "./simConfig";

function otherStage(stage: DealStage): DealStage {
  return stage === "Won" ? "Lost" : "Won";
}

const ME = "Rahul Sharma";

describe("fake deal API", () => {
  beforeEach(() => {
    updateSimConfig({
      minDelayMs: 0,
      maxDelayMs: 0,
      failureRate: 0,
      teammateEditsPerMinute: 0,
    });
    setRole("manager");
  });

  afterEach(() => {
    updateSimConfig(DEFAULT_SIM_CONFIG);
    setRole("rep");
  });

  it("saves a move and bumps the version", async () => {
    const deal = mockDeals[0];
    const target = otherStage(deal.stage);
    const versionBefore = deal.version;

    const result = await updateDealStage({
      id: deal.id,
      newStage: target,
      expectedVersion: versionBefore,
    });

    expect(result.status).toBe("success");
    expect(result.status === "success" && result.deal.version).toBe(versionBefore + 1);
    expect(deal.stage).toBe(target);
  });

  it("stamps the close date when a deal is won or lost and restores it when reopened", async () => {
    const deal = mockDeals.find(
      (item, index) => index >= 30 && item.stage === "Negotiation" && item.closeDate !== null
    )!;
    const expectedClose = deal.closeDate;
    const before = Date.now();

    await updateDealStage({ id: deal.id, newStage: "Won", expectedVersion: deal.version });
    const wonOn = Date.parse(deal.closeDate!);

    expect(wonOn).toBeGreaterThanOrEqual(before);
    expect(wonOn).toBeLessThanOrEqual(Date.now());

    await updateDealStage({ id: deal.id, newStage: "Lost", expectedVersion: deal.version });
    expect(Date.parse(deal.closeDate!)).toBeGreaterThanOrEqual(wonOn);

    await updateDealStage({ id: deal.id, newStage: "Negotiation", expectedVersion: deal.version });
    expect(deal.closeDate).toBe(expectedClose);
  });

  it("gives generated won and lost deals a close date", () => {
    const closed = mockDeals.filter((deal) => deal.stage === "Won" || deal.stage === "Lost");

    expect(closed.every((deal) => deal.closeDate !== null)).toBe(true);
  });

  it("rejects a save based on an old version instead of overwriting", async () => {
    const deal = mockDeals[1];
    const staleVersion = deal.version;

    simulateTeammateEdit(deal.id);
    const teammateStage = deal.stage;

    const result = await updateDealStage({
      id: deal.id,
      newStage: otherStage(teammateStage),
      expectedVersion: staleVersion,
    });

    expect(result.status).toBe("conflict");
    expect(deal.stage).toBe(teammateStage);
  });

  it("fails without changing anything when the network fails", async () => {
    updateSimConfig({ failureRate: 1 });
    const deal = mockDeals[2];
    const before = { stage: deal.stage, version: deal.version };

    const result = await updateDealStage({
      id: deal.id,
      newStage: otherStage(deal.stage),
      expectedVersion: deal.version,
    });

    expect(result.status).toBe("failed");
    expect({ stage: deal.stage, version: deal.version }).toEqual(before);
  });

  it("returns copies so the UI can never mutate the server data", async () => {
    const { data } = await getDeals({
      search: "",
      stage: null,
      scope: "all",
      quickFilter: null,
      sortKey: "value",
      sortDirection: "desc",
      offset: 0,
      limit: 1,
    });

    const original = mockDeals.find((deal) => deal.id === data[0].id)!;
    data[0].notes.push({ id: "x", text: "x", createdBy: "x", createdAt: "x" });

    expect(original.notes).not.toBe(data[0].notes);
    expect(original.notes.length).toBe(data[0].notes.length - 1);
  });

  it("keeps the same order across batches of one list, even if a teammate edits in between", async () => {
    const query = {
      search: "",
      stage: null,
      scope: "all" as const,
      quickFilter: null,
      sortKey: "updatedAt" as const,
      sortDirection: "desc" as const,
    };

    const firstBatch = await getDeals({ ...query, offset: 0, limit: 5 });
    const expectedSecondBatch = (await getDeals({ ...query, offset: 5, limit: 5, snapshotId: firstBatch.snapshotId })).data.map((deal) => deal.id);

    simulateTeammateEdit(expectedSecondBatch[2]);

    const sameList = await getDeals({ ...query, offset: 5, limit: 5, snapshotId: firstBatch.snapshotId });
    const freshList = await getDeals({ ...query, offset: 5, limit: 5 });

    expect(sameList.data.map((deal) => deal.id)).toEqual(expectedSecondBatch);
    expect(sameList.data[2].version).toBeGreaterThan(1);
    expect(freshList.data.map((deal) => deal.id)).not.toEqual(expectedSecondBatch);
  });

  it("does not let a representative reuse a manager's list", async () => {
    const query = {
      search: "",
      stage: null,
      scope: "all" as const,
      quickFilter: null,
      sortKey: "value" as const,
      sortDirection: "desc" as const,
    };

    const managerList = await getDeals({ ...query, offset: 0, limit: 20 });
    setRole("rep");
    const repList = await getDeals({ ...query, offset: 0, limit: 20, snapshotId: managerList.snapshotId });

    expect(repList.snapshotId).not.toBe(managerList.snapshotId);
    expect(repList.data.every((deal) => deal.ownerName === ME)).toBe(true);
  });

  it("returns one result per deal in a bulk save", async () => {
    const deals = mockDeals.slice(10, 15);

    const results = await updateDealsStage(
      deals.map((deal) => ({
        id: deal.id,
        newStage: otherStage(deal.stage),
        expectedVersion: deal.version,
      }))
    );

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.status === "success")).toBe(true);
  });

  it("tells subscribers about teammate changes", () => {
    const events: DealChangeEvent[] = [];
    const unsubscribe = subscribeToDealChanges((event) => events.push(event));

    simulateTeammateEdit(mockDeals[20].id);
    unsubscribe();
    simulateTeammateEdit(mockDeals[21].id);

    expect(events).toHaveLength(1);
    expect(events[0].deal.id).toBe(mockDeals[20].id);
    expect(events[0].deal.stage).not.toBe(events[0].previousStage);
  });

  describe("access for a sales representative (enforced by the server)", () => {
    beforeEach(() => {
      setRole("rep");
    });

    const teammateDeal = () => mockDeals.find((deal) => deal.ownerName !== ME)!;
    const ownDeal = () => mockDeals.find((deal) => deal.ownerName === ME)!;

    it("gets only their own deals even when asking for the whole team", async () => {
      const { data, total } = await getDeals({
        search: "",
        stage: null,
        scope: "all",
        quickFilter: null,
        sortKey: "value",
        sortDirection: "desc",
        offset: 0,
        limit: 200,
      });

      expect(total).toBe(mockDeals.filter((deal) => deal.ownerName === ME).length);
      expect(data.every((deal) => deal.ownerName === ME)).toBe(true);
    });

    it("cannot change a teammate's deal, and nothing is saved", async () => {
      const deal = teammateDeal();
      const before = { stage: deal.stage, version: deal.version };

      const result = await updateDealStage({
        id: deal.id,
        newStage: otherStage(deal.stage),
        expectedVersion: deal.version,
      });

      expect(result).toMatchObject({ status: "failed", retryable: false });
      expect({ stage: deal.stage, version: deal.version }).toEqual(before);
    });

    it("can still change their own deal", async () => {
      const deal = ownDeal();

      const result = await updateDealStage({
        id: deal.id,
        newStage: otherStage(deal.stage),
        expectedVersion: deal.version,
      });

      expect(result.status).toBe("success");
    });

    it("is not told about changes to deals they are not allowed to see", () => {
      const events: DealChangeEvent[] = [];
      const unsubscribe = subscribeToDealChanges((event) => events.push(event));

      simulateTeammateEdit(teammateDeal().id);
      simulateTeammateEdit(ownDeal().id);
      unsubscribe();

      expect(events.map((event) => event.deal.ownerName)).toEqual([ME]);
    });
  });
});
