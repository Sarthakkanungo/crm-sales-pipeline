
// import type { Deal } from "../features/deals/types/deal.types";
import { generateDeals } from "./generateDeals";

export const mockDeals = generateDeals(10000);
// export const mockDeals: Deal[] = [
//   {
//     id: "deal-001",
//     name: "EV Fleet Management",
//     companyName: "ABC Logistics",
//     licenceCount: 50,
//     value: 500000,
//     currency: "INR",
//     ownerName: "Rahul Sharma",
//     stage: "New Lead",
//     closeDate: "2026-12-15",
//     updatedAt: new Date().toISOString(),
//     version: 1,
//   },
//   {
//     id: "deal-002",
//     name: "Fleet Tracking Software",
//     companyName: "XYZ Transport",
//     licenceCount: 100,
//     value: 850000,
//     currency: "INR",
//     ownerName: "Priya Singh",
//     stage: "Demo Done",
//     closeDate: "2026-12-20",
//     updatedAt: new Date().toISOString(),
//     version: 1,
//   },
//   {
//     id: "deal-003",
//     name: "EV Charging Platform",
//     companyName: "Green Mobility",
//     licenceCount: 25,
//     value: 250000,
//     currency: "INR",
//     ownerName: "Amit Verma",
//     stage: "Negotiation",
//     closeDate: null,
//     updatedAt: new Date().toISOString(),
//     version: 1,
//   },
// ];
