
import type { Deal } from "../types/deal.types";
import { mockDeals } from "../../../mock/mockdatabase";

interface GetDealsResponse {
  data: Deal[];
  total: number;
}

export async function getDeals(
  page: number,
  pageSize: number
): Promise<GetDealsResponse> {
  // Simulate network latency: 300ms to 1500ms
  const delay = Math.floor(Math.random() * 1200) + 300;

  await new Promise((resolve) => setTimeout(resolve, delay));

  // Calculate which records belong to this page
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // Return only the requested records
  const data = mockDeals.slice(startIndex, endIndex);

  return {
    data,
    total: mockDeals.length,
  };
}
