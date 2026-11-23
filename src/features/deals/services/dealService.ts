import { CURRENT_USER } from "../../../config/currentUser";
import { OWNERS } from "../../../mock/generateDeals";
import { dealIndex, mockDeals } from "../../../mock/mockdatabase";
import {
  buildDashboard,
  countViewTabs,
  type DashboardData,
  type ViewTabCounts,
} from "../logic/dashboard";
import { createQueryEngine } from "../logic/queryEngine";
import {
  DEAL_STAGES,
  type Deal,
  type DealChangeEvent,
  type DealQuery,
  type DealScope,
  type DealStage,
  type DealUpdateRequest,
  type DealUpdateResult,
  type FollowUpUpdateRequest,
} from "../types/deal.types";
import { allowedScope, canEditDeal, canViewDeal } from "../../session/permissions";
import { getSession } from "../../session/sessionStore";
import { getSimConfig, simConfigStore } from "./simConfig";

export interface GetDealsParams extends DealQuery {
  offset: number;
  limit: number;
  snapshotId?: string;
}

export interface GetDealsResponse {
  data: Deal[];
  total: number;
  snapshotId: string;
}

interface Snapshot {
  role: string;
  deals: readonly Deal[];
}

export interface BulkCandidate {
  id: string;
  version: number;
  stage: DealStage;
  name: string;
  companyName: string;
}

type DealChangeListener = (event: DealChangeEvent) => void;

const TEAMMATES = OWNERS.filter((owner) => owner !== CURRENT_USER);
const changeListeners = new Set<DealChangeListener>();
const queryEngine = createQueryEngine(mockDeals, dealIndex);
const snapshots = new Map<string, Snapshot>();
const MAX_SNAPSHOTS = 12;
let nextSnapshotNumber = 0;
let lastServedIds: string[] = [];

function openSnapshot(deals: readonly Deal[]): string {
  nextSnapshotNumber += 1;
  const snapshotId = `snapshot-${nextSnapshotNumber}`;

  snapshots.set(snapshotId, { role: getSession().role, deals });

  if (snapshots.size > MAX_SNAPSHOTS) {
    snapshots.delete(snapshots.keys().next().value!);
  }

  return snapshotId;
}

function findSnapshot(snapshotId: string | undefined): Snapshot | undefined {
  const snapshot = snapshotId ? snapshots.get(snapshotId) : undefined;

  return snapshot && snapshot.role === getSession().role ? snapshot : undefined;
}

function cloneDeal(deal: Deal): Deal {
  return structuredClone(deal);
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function simulateNetworkDelay(): Promise<void> {
  const { minDelayMs, maxDelayMs } = getSimConfig();
  const low = Math.max(0, Math.min(minDelayMs, maxDelayMs));
  const high = Math.max(minDelayMs, maxDelayMs);
  const delay = low + Math.random() * (high - low);

  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

function shouldFailSave(): boolean {
  return Math.random() < getSimConfig().failureRate;
}

function applyWrite(
  id: string,
  expectedVersion: number,
  mutate: (deal: Deal) => void
): DealUpdateResult {
  const deal = dealIndex.get(id);

  if (!deal) {
    return {
      status: "failed",
      id,
      message: "Deal not found.",
      retryable: false,
    };
  }

  if (!canEditDeal(getSession(), deal)) {
    return {
      status: "failed",
      id,
      message: "You don't have permission to change this deal.",
      retryable: false,
    };
  }

  if (deal.version !== expectedVersion) {
    return {
      status: "conflict",
      id,
      latestDeal: cloneDeal(deal),
      message: "This deal was changed by someone else.",
    };
  }

  if (shouldFailSave()) {
    return {
      status: "failed",
      id,
      message: "The server did not save this change.",
      retryable: true,
    };
  }

  const previousStage = deal.stage;

  mutate(deal);
  deal.updatedAt = new Date().toISOString();
  deal.updatedBy = CURRENT_USER;
  deal.version += 1;
  queryEngine.recordChange(deal, previousStage);

  return { status: "success", deal: cloneDeal(deal) };
}

function permittedQuery<T extends DealQuery>(query: T): T {
  return { ...query, scope: allowedScope(getSession(), query.scope) };
}

export async function getDeals(
  params: GetDealsParams
): Promise<GetDealsResponse> {
  await simulateNetworkDelay();

  const existing = findSnapshot(params.snapshotId);
  const matches =
    existing?.deals ?? queryEngine.run(permittedQuery(params), CURRENT_USER, new Date());
  const snapshotId =
    existing && params.snapshotId ? params.snapshotId : openSnapshot(matches);
  const rows = matches.slice(params.offset, params.offset + params.limit);

  lastServedIds = rows.map((deal) => deal.id);

  return { data: rows.map(cloneDeal), total: matches.length, snapshotId };
}

export async function getBulkCandidates(
  query: DealQuery
): Promise<BulkCandidate[]> {
  await simulateNetworkDelay();

  return queryEngine
    .run(permittedQuery(query), CURRENT_USER, new Date())
    .map((deal) => ({
      id: deal.id,
      version: deal.version,
      stage: deal.stage,
      name: deal.name,
      companyName: deal.companyName,
    }));
}

export async function getDashboardData(
  scope: DealScope
): Promise<DashboardData> {
  await simulateNetworkDelay();

  const deals =
    allowedScope(getSession(), scope) === "mine"
      ? mockDeals.filter((deal) => deal.ownerName === CURRENT_USER)
      : mockDeals;

  return buildDashboard(deals, new Date(), queryEngine.keysOf);
}

export async function getViewTabCounts(query: DealQuery): Promise<ViewTabCounts> {
  await simulateNetworkDelay();

  const now = new Date();
  const deals = queryEngine.run(
    permittedQuery({ ...query, quickFilter: null }),
    CURRENT_USER,
    now
  );

  return countViewTabs(deals, now, queryEngine.keysOf);
}

export async function updateDealStage(
  request: DealUpdateRequest
): Promise<DealUpdateResult> {
  await simulateNetworkDelay();

  return applyWrite(request.id, request.expectedVersion, (deal) => {
    deal.stage = request.newStage;
  });
}

export async function updateDealsStage(
  requests: DealUpdateRequest[]
): Promise<DealUpdateResult[]> {
  await simulateNetworkDelay();

  return requests.map((request) =>
    applyWrite(request.id, request.expectedVersion, (deal) => {
      deal.stage = request.newStage;
    })
  );
}

export async function updateDealFollowUp(
  request: FollowUpUpdateRequest
): Promise<DealUpdateResult> {
  await simulateNetworkDelay();

  return applyWrite(request.id, request.expectedVersion, (deal) => {
    deal.nextFollowUpAt = request.nextFollowUpAt;
  });
}

export async function addDealNote(
  dealId: string,
  noteText: string
): Promise<Deal> {
  await simulateNetworkDelay();

  const deal = dealIndex.get(dealId);

  if (!deal) {
    throw new Error("Deal not found.");
  }

  if (shouldFailSave()) {
    throw new Error("The server did not save this note.");
  }

  const createdAt = new Date().toISOString();

  deal.notes.push({
    id: crypto.randomUUID(),
    text: noteText,
    createdBy: CURRENT_USER,
    createdAt,
  });

  deal.updatedAt = createdAt;
  deal.updatedBy = CURRENT_USER;
  queryEngine.recordChange(deal, deal.stage);

  return cloneDeal(deal);
}

export function subscribeToDealChanges(
  listener: DealChangeListener
): () => void {
  changeListeners.add(listener);

  return () => {
    changeListeners.delete(listener);
  };
}

export function simulateTeammateEdit(dealId?: string): Deal | null {
  const targetId =
    dealId ??
    (lastServedIds.length > 0 && Math.random() < 0.7
      ? pickRandom(lastServedIds)
      : pickRandom(mockDeals).id);

  const deal = dealIndex.get(targetId);

  if (!deal) {
    return null;
  }

  const previousStage = deal.stage;

  deal.stage = pickRandom(DEAL_STAGES.filter((stage) => stage !== deal.stage));
  deal.updatedAt = new Date().toISOString();
  deal.updatedBy = pickRandom(TEAMMATES);
  deal.version += 1;
  queryEngine.recordChange(deal, previousStage);

  if (canViewDeal(getSession(), deal)) {
    for (const listener of changeListeners) {
      listener({ deal: cloneDeal(deal), previousStage });
    }
  }

  return cloneDeal(deal);
}

export function startTeammateSimulation(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule(): void {
    clearTimeout(timer);

    const perMinute = getSimConfig().teammateEditsPerMinute;

    if (perMinute <= 0) {
      return;
    }

    const averageGap = 60000 / perMinute;
    const gap = averageGap * (0.5 + Math.random());

    timer = setTimeout(() => {
      simulateTeammateEdit();
      schedule();
    }, gap);
  }

  schedule();

  const unsubscribe = simConfigStore.subscribe((state, previous) => {
    if (state.teammateEditsPerMinute !== previous.teammateEditsPerMinute) {
      schedule();
    }
  });

  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
