
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
  updatedAt: string;

  version: number;
}

