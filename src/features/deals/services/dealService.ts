
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
