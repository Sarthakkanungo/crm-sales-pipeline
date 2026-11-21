import { useEffect, useState } from "react";
import { getDeals } from "./features/deals/services/dealService";
import {
  DEAL_STAGES,
  type Deal,
  type DealStage,
} from "./features/deals/types/deal.types";

const PAGE_SIZE = 50;

function App() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<DealStage | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadDeals() {
      setIsLoading(true);
      setError("");

      try {
        const response = await getDeals({
          page,
          pageSize: PAGE_SIZE,
          search,
          stage: stage || undefined,
        });

        if (isCurrentRequest) {
          setDeals(response.data);
          setTotal(response.total);
        }
      } catch {
        if (isCurrentRequest) {
          setError("Could not load deals. Please try again.");
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      }
    }

    const timeoutId = setTimeout(() => {
      void loadDeals();
    }, 300);

    return () => {
      isCurrentRequest = false;
      clearTimeout(timeoutId);
    };
  }, [page, search, stage]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStageChange(value: string) {
    setStage(value as DealStage | "");
    setPage(1);
  }

  return (
    <main className="app">
      <header className="page-header">
        <div>
          <h1>Sales Pipeline</h1>
          <p>Manage and track your sales deals.</p>
        </div>
        <span className="total-count">{total.toLocaleString()} deals</span>
      </header>

      <section className="toolbar" aria-label="Deal filters">
        <label>
          Search deals
          <input
            type="search"
            placeholder="Search deal or company..."
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
        </label>

        <label>
          Stage
          <select
            value={stage}
            onChange={(event) => handleStageChange(event.target.value)}
          >
            <option value="">All stages</option>
            {DEAL_STAGES.map((dealStage) => (
              <option key={dealStage} value={dealStage}>
                {dealStage}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && <p role="alert" className="error-message">{error}</p>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Deal</th>
              <th>Company</th>
              <th>Owner</th>
              <th>Stage</th>
              <th>Value</th>
              <th>Close date</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="empty-state">Loading deals…</td>
              </tr>
            ) : deals.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">No matching deals found.</td>
              </tr>
            ) : (
              deals.map((deal) => (
                <tr key={deal.id}>
                  <td>{deal.name}</td>
                  <td>{deal.companyName}</td>
                  <td>{deal.ownerName}</td>
                  <td>{deal.stage}</td>
                  <td>
                    {deal.value.toLocaleString("en-IN", {
                      style: "currency",
                      currency: deal.currency,
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td>{deal.closeDate ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="pagination">
        <span>
          {total === 0
            ? "No deals"
            : `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(
                page * PAGE_SIZE,
                total
              )} of ${total.toLocaleString()}`}
        </span>

        <div className="pagination-controls">
          <button
            type="button"
            disabled={page === 1 || isLoading}
            onClick={() => setPage((currentPage) => currentPage - 1)}
          >
            Previous
          </button>

          <span>Page {page} of {totalPages}</span>

          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((currentPage) => currentPage + 1)}
          >
            Next
          </button>
        </div>
      </footer>
    </main>
  );
}

export default App;