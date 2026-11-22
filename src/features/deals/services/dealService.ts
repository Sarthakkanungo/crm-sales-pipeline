
import type { Deal, DealStage } from "../types/deal.types";
import { mockDeals } from "../../../mock/mockdatabase";

interface GetDealsResponse {
  data: Deal[];
  total: number;
}

interface GetDealsParams {
    page : number ;
    pageSize : number ;
    search? : string;
    stage? : DealStage;
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


export async function updateDealStage(
  request: DealUpdateRequest
): Promise<DealUpdateResult> {
  await simulateNetworkDelay();

  const deal = mockDeals.find(
    (item) => item.id === request.id
  );

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
  deal.updatedBy = "Rahul Sharma";
  deal.version += 1;

  return {
    status: "success",
    deal: { ...deal },
  };
}



export async function getDeals({
  page ,
  pageSize ,
  search = "",
  stage,
}: GetDealsParams): Promise<GetDealsResponse> {

  const delay = Math.floor(Math.random() * 1200) + 300;

  await new Promise((resolve) => setTimeout(resolve, delay));

  const searchText = search.trim().toLowerCase();

  let filteredDeals = mockDeals.filter((deal)=> {
    return(
        deal.name.toLowerCase().includes(searchText) || 
        deal.companyName.toLowerCase().includes(searchText) 
    );
  });

  if(stage)
  {
    filteredDeals = filteredDeals.filter((deal) => {
        return ( deal.stage === stage
               )
        })
  }

  const total = filteredDeals.length ;

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  
  const data = filteredDeals.slice(startIndex, endIndex);

  return {
    data,
    total,
  };
}


export async function updateDealsStage(
  requests: DealUpdateRequest[]
): Promise<DealUpdateResult[]> {
  await simulateNetworkDelay();

  const results: DealUpdateResult[] = [];

  for (const request of requests) {
    const deal = mockDeals.find(
      (item) => item.id === request.id
    );

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
    deal.updatedBy = "Rahul Sharma";
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
  const deal = mockDeals.find(
    (item) => item.id === dealId
  );

  if (!deal) {
    return null;
  }

  deal.stage = newStage;
  deal.updatedAt = new Date().toISOString();
  deal.updatedBy = "Priya Singh";
  deal.version += 1;

  return { ...deal };
}

