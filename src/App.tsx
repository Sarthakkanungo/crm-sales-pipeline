import { useEffect } from "react";
import { getDeals } from "./features/deals/services/dealService";

function App() {
  useEffect(() => {
    async function loadDeals() {
      const response = await getDeals(1, 50);

      console.log("Total deals:", response.total);
      console.log("First page:", response.data);
      console.log("Number of records:", response.data.length);
    }

    loadDeals();
  }, []);

  return (
    <div>
      <h1>Sales Pipeline Dashboard</h1>
    </div>
  );
}

export default App;