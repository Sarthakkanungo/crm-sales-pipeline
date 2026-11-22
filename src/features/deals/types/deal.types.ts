
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
  // Unique identification
  id: string;

  // Customer and deal information
  name: string;
  companyName: string;
  licenceCount: number;
  value: number;
  currency: "INR";

  ownerName: string;

  // Sales pipeline
  stage: DealStage;
  closeDate: string | null;

  // Customer interactions
  notes: DealNote[];
  nextFollowUpAt: string | null;

  // Collaboration and concurrency
  updatedAt: string;
  updatedBy: string;
  version: number;
}
