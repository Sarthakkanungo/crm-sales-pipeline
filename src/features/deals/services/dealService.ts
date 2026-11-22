
import type { Deal, DealStage } from "../types/deal.types";
import { DEAL_STAGES } from "../types/deal.types";
import { mockDeals } from "../../../mock/mockdatabase";

const CURRENT_USER = "Rahul Sharma";

interface GetDealsResponse {
  data: Deal[];
  total: number;
}

interface GetDealsParams {
  page: number;
  pageSize: number;
  search?: string;
  stage?: DealStage;
  ownerName?: string;
}

export interface DashboardData {
  activeDeals: number;
  dueToday: number;
  overdue: number;
  wonDeals: number;
  stageCounts: Record<DealStage, number>;
  followUps: Deal[];
}

export interface DealUpdateRequest {
  id: string;
  newStage: DealStage;
  expectedVersion: number;
}

export type DealUpdateResult =
  | {
      status: "success";
      deal: Deal;
    }
  | {
      status: "conflict";
      id: string;
      latestDeal: Deal;
      message: string;
    }
  | {
      status: "failed";
      id: string;
      message: string;
      retryable: boolean;
    };

function simulateNetworkDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 1200) + 300;

  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

// Returns the start of today in the user's local timezone.
function getStartOfToday(): Date {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

// Returns the start of tomorrow in the user's local timezone.
function getStartOfTomorrow(): Date {
  const tomorrow = getStartOfToday();

  tomorrow.setDate(tomorrow.getDate() + 1);

  return tomorrow;
}

export async function getDashboardData(
  ownerName: string = CURRENT_USER
): Promise<DashboardData> {
  await simulateNetworkDelay();

  // Only calculate metrics for this salesperson.
  const ownedDeals = mockDeals.filter(
    (deal) => deal.ownerName === ownerName
  );

  const today = getStartOfToday();
  const tomorrow = getStartOfTomorrow();

  const stageCounts = Object.fromEntries(
    DEAL_STAGES.map((stage) => [stage, 0])
  ) as Record<DealStage, number>;

  let activeDeals = 0;
  let dueToday = 0;
  let overdue = 0;

  const followUps: Deal[] = [];

  for (const deal of ownedDeals) {
    stageCounts[deal.stage] += 1;

    if (deal.stage !== "Won" && deal.stage !== "Lost") {
      activeDeals += 1;
    }

    if (!deal.nextFollowUpAt) {
      continue;
    }

    const followUpDate = new Date(deal.nextFollowUpAt);

    if (followUpDate >= today && followUpDate < tomorrow) {
      dueToday += 1;
      followUps.push(deal);
    } else if (followUpDate < today) {
      overdue += 1;
      followUps.push(deal);
    }
  }

  followUps.sort((a, b) => {
    return (
      new Date(a.nextFollowUpAt!).getTime() -
      new Date(b.nextFollowUpAt!).getTime()
    );
  });

  return {
    activeDeals,
    dueToday,
    overdue,
    wonDeals: stageCounts["Won"],
    stageCounts,
    followUps,
  };
}

export async function getDeals({
  page,
  pageSize,
  search = "",
  stage,
  ownerName = CURRENT_USER,
}: GetDealsParams): Promise<GetDealsResponse> {
  await simulateNetworkDelay();

  const searchText = search.trim().toLowerCase();

  let filteredDeals = mockDeals.filter((deal) => {
    const matchesOwner = deal.ownerName === ownerName;

    const matchesSearch =
      deal.name.toLowerCase().includes(searchText) ||
      deal.companyName.toLowerCase().includes(searchText);

    const matchesStage = !stage || deal.stage === stage;

    return matchesOwner && matchesSearch && matchesStage;
  });

  const total = filteredDeals.length;

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const data = filteredDeals.slice(startIndex, endIndex);

  return { data, total };
}

export async function updateDealStage(
  request: DealUpdateRequest
): Promise<DealUpdateResult> {
  await simulateNetworkDelay();

  const deal = mockDeals.find((item) => item.id === request.id);

  if (!deal) {
    return {
      status: "failed",
      id: request.id,
      message: "Deal not found.",
      retryable: false,
    };
  }

  if (deal.version !== request.expectedVersion) {
    return {
      status: "conflict",
      id: deal.id,
      latestDeal: { ...deal },
      message: "This deal was modified by another user.",
    };
  }

  if (Math.random() < 0.1) {
    return {
      status: "failed",
      id: deal.id,
      message: "Save failed. Please try again.",
      retryable: true,
    };
  }

  deal.stage = request.newStage;
  deal.updatedAt = new Date().toISOString();
  deal.updatedBy = CURRENT_USER;
  deal.version += 1;

  return {
    status: "success",
    deal: { ...deal },
  };
}

export async function updateDealsStage(
  requests: DealUpdateRequest[]
): Promise<DealUpdateResult[]> {
  await simulateNetworkDelay();

  const results: DealUpdateResult[] = [];

  for (const request of requests) {
    const deal = mockDeals.find((item) => item.id === request.id);

    if (!deal) {
      results.push({
        status: "failed",
        id: request.id,
        message: "Deal not found.",
        retryable: false,
      });
      continue;
    }

    if (deal.version !== request.expectedVersion) {
      results.push({
        status: "conflict",
        id: deal.id,
        latestDeal: { ...deal },
        message: "This deal was modified by another user.",
      });
      continue;
    }

    if (Math.random() < 0.1) {
      results.push({
        status: "failed",
        id: deal.id,
        message: "Save failed. Please try again.",
        retryable: true,
      });
      continue;
    }

    deal.stage = request.newStage;
    deal.updatedAt = new Date().toISOString();
    deal.updatedBy = CURRENT_USER;
    deal.version += 1;

    results.push({
      status: "success",
      deal: { ...deal },
    });
  }

  return results;
}

export function simulateTeammateUpdate(
  dealId: string,
  newStage: DealStage
): Deal | null {
  const deal = mockDeals.find((item) => item.id === dealId);

  if (!deal) {
    return null;
  }

  deal.stage = newStage;
  deal.updatedAt = new Date().toISOString();
  deal.updatedBy = "Priya Singh";
  deal.version += 1;

  return { ...deal };
}


export async function addDealNote(
  dealId: string,
  noteText: string
): Promise<Deal> {
  await simulateNetworkDelay();

  const deal = mockDeals.find((item) => item.id === dealId);

  if (!deal) {
    throw new Error("Deal not found");
  }

  const newNote = {
    id: `note-${Date.now()}`,
    text: noteText,
    createdBy: CURRENT_USER,
    createdAt: new Date().toISOString(),
  };

  deal.notes.push(newNote);

  deal.updatedAt = new Date().toISOString();
  deal.updatedBy = CURRENT_USER;
  deal.version += 1;

  return { ...deal, notes: [...deal.notes] };
}

export async function updateDealFollowUp(
  dealId: string,
  followUpDate: string
): Promise<Deal> {
  await simulateNetworkDelay();

  const deal = mockDeals.find((item) => item.id === dealId);

  if (!deal) {
    throw new Error("Deal not found");
  }

  deal.nextFollowUpAt = followUpDate;
  deal.updatedAt = new Date().toISOString();
  deal.updatedBy = CURRENT_USER;
  deal.version += 1;

  return { ...deal, notes: [...deal.notes] };
}