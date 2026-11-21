import {
  DEAL_STAGES,
  type Deal,
  type DealStage,
} from "../features/deals/types/deal.types";

const COMPANIES = [
  "ABC Logistics",
  "XYZ Transport",
  "Green Mobility",
  "FastTrack Solutions",
  "Global Fleet",
  "Urban EV",
  "Swift Cargo",
  "Reliable Transport",
];

const OWNERS = [
  "Rahul Sharma",
  "Priya Singh",
  "Amit Verma",
  "Neha Patel",
  "Vikram Rao",
  "Salonee Tare",
];

const DEAL_NAMES = [
  "EV Fleet Management",
  "Fleet Tracking Software",
  "EV Charging Platform",
  "Vehicle Management System",
  "Logistics Automation",
  "Fleet Analytics Platform",
];

const randomItem = <T,>(items: readonly T[]): T => {
  return items[Math.floor(Math.random() * items.length)];
};

const randomNumber = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export function generateDeals(count: number): Deal[] {
  return Array.from({ length: count }, (_, index) => {
    const stage: DealStage = randomItem(DEAL_STAGES);

    return {
      id: `deal-${index + 1}`,
      name: randomItem(DEAL_NAMES),
      companyName: randomItem(COMPANIES),
      licenceCount: randomNumber(10, 500),
      value: randomNumber(100000, 10000000),
      currency: "INR",
      ownerName: randomItem(OWNERS),
      stage,
      closeDate:
        stage === "Won" || stage === "Lost"
          ? null
          : `2026-${String(randomNumber(1, 12)).padStart(2, "0")}-${String(randomNumber(1, 28)).padStart(2, "0")}`,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  });
}
