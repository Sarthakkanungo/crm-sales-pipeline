
import {
  DEAL_STAGES,
  type Deal,
  type DealNote,
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
  "Anjali Mehta",
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


function generateNotes(ownerName: string): DealNote[] {
  const hasNote = Math.random() < 0.3;

  if (!hasNote) {
    return [];
  }

  return [
    {
      id: `note-${Math.random().toString(36).slice(2, 10)}`,
      text: "Customer is interested. Follow up with pricing details.",
      createdBy: ownerName,
      createdAt: new Date().toISOString(),
    },
  ];
}

// Generate upcoming or overdue follow-up dates.
function generateFollowUpDate(): string | null {
  const hasFollowUp = Math.random() < 0.4;

  if (!hasFollowUp) {
    return null;
  }

  const daysFromToday = randomNumber(-2, 5);
  const followUpDate = new Date();

  followUpDate.setDate(
    followUpDate.getDate() + daysFromToday
  );

  return followUpDate.toISOString();
}

export function generateDeals(count: number): Deal[] {
  return Array.from({ length: count }, (_, index) => {
    const stage: DealStage = randomItem(DEAL_STAGES);
    const ownerName = randomItem(OWNERS);

    return {
      id: `deal-${index + 1}`,
      name: randomItem(DEAL_NAMES),
      companyName: randomItem(COMPANIES),
      licenceCount: randomNumber(10, 500),
      value: randomNumber(100000, 10000000),
      currency: "INR",
      ownerName,
      stage,

      closeDate:
        stage === "Won" || stage === "Lost"
          ? null
          : `2026-${String(randomNumber(1, 12)).padStart(2, "0")}-${String(randomNumber(1, 28)).padStart(2, "0")}`,

     
      notes: generateNotes(ownerName),
      nextFollowUpAt: generateFollowUpDate(),

   
      updatedAt: new Date().toISOString(),
      updatedBy: ownerName,
      version: 1,
    };
  });
}
