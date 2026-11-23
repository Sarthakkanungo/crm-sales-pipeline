export const DEAL_STAGES = [
  "New Lead",
  "Contacted",
  "Demo Done",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export interface DealNote {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
}

export interface Deal {
  id: string;
  name: string;
  companyName: string;
  licenceCount: number;
  value: number;
  currency: "INR";
  ownerName: string;
  stage: DealStage;
  closeDate: string | null;
  notes: DealNote[];
  nextFollowUpAt: string | null;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export type DealScope = "mine" | "all";

export type QuickFilter = "active" | "overdue" | "dueToday" | "updatedToday";

export type SortKey = "nextFollowUpAt" | "value" | "closeDate" | "updatedAt";

export type SortDirection = "asc" | "desc";

export interface DealQuery {
  search: string;
  stage: DealStage | null;
  scope: DealScope;
  quickFilter: QuickFilter | null;
  sortKey: SortKey;
  sortDirection: SortDirection;
}

export interface DealUpdateRequest {
  id: string;
  newStage: DealStage;
  expectedVersion: number;
}

export interface FollowUpUpdateRequest {
  id: string;
  nextFollowUpAt: string;
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

export interface DealChangeEvent {
  deal: Deal;
  previousStage: DealStage;
}
