import type { Deal } from "../features/deals/types/deal.types";
import { generateDeals } from "./generateDeals";

export const mockDeals: Deal[] = generateDeals(50000);

export const dealIndex: Map<string, Deal> = new Map(
  mockDeals.map((deal) => [deal.id, deal])
);
