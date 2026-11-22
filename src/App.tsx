
import { useEffect, useState, type FormEvent } from "react";
import {
  addDealNote,
  getDashboardData,
  getDeals,
  updateDealFollowUp,
  updateDealStage,
  type DashboardData,
} from "./features/deals/services/dealService";

import {
  DEAL_STAGES,
  type Deal,
  type DealStage,
} from "./features/deals/types/deal.types";

import "./App.css";

const PAGE_SIZE = 50;
const CURRENT_USER = "Rahul Sharma";

function formatCurrency(value: number, currency: string) {
  return value.toLocaleString("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

function formatFollowUpDate(date: string) {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getFollowUpStatus(date: string): "Overdue" | "Today" {
  const followUpDate = new Date(date);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return followUpDate < today ? "Overdue" : "Today";
}



function App() {
  // Deals table state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<DealStage | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Dashboard state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [noteText, setNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState("");


  const [followUpDate, setFollowUpDate] = useState("");
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState("");

  const [selectedStage, setSelectedStage] = useState<DealStage | "">("");
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [stageError, setStageError] = useState("");
  const [stageSuccess, setStageSuccess] = useState("");

  // Load dashboard data
  useEffect(() => {
    let isCurrentRequest = true;

    async function loadDashboard() {
      setIsDashboardLoading(true);
      setDashboardError("");

      try {
        const response = await getDashboardData(CURRENT_USER);

        if (isCurrentRequest) {
          setDashboard(response);
        }
      } catch {
        if (isCurrentRequest) {
          setDashboardError("Could not load dashboard data.");
        }
      } finally {
        if (isCurrentRequest) {
          setIsDashboardLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  // Load deals whenever search, stage or page changes
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
          ownerName: CURRENT_USER,
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


  async function handleSaveFollowUp() {
    if (!selectedDeal || !followUpDate) {
      return;
    }

    try {
      setIsSavingFollowUp(true);
      setFollowUpError("");

      const updatedDeal = await updateDealFollowUp(
        selectedDeal.id,
        new Date(followUpDate).toISOString()
      );

      // Update the selected deal in the drawer.
      setSelectedDeal(updatedDeal);

      // Update the deal in the current table page.
      setDeals((currentDeals) =>
        currentDeals.map((deal) =>
          deal.id === updatedDeal.id ? updatedDeal : deal
        )
      );

      setFollowUpDate("");

      // Refresh dashboard separately.
      try {
        const dashboardResponse = await getDashboardData(CURRENT_USER);
        setDashboard(dashboardResponse);
        setDashboardError("");
      } catch {
        setDashboardError(
          "Follow-up saved, but dashboard could not be refreshed."
        );
      }
    } catch {
      setFollowUpError("Could not save follow-up. Please try again.");
    } finally {
      setIsSavingFollowUp(false);
    }
  }


async function handleSaveStage() {
  if (!selectedDeal || !selectedStage) {
    return;
  }

  const previousDeal = selectedDeal;

  // 1. Optimistically update the UI
  const optimisticDeal: Deal = {
    ...previousDeal,
    stage: selectedStage,
    updatedAt: new Date().toISOString(),
    updatedBy: "Rahul Sharma",
  };

  setSelectedDeal(optimisticDeal);

  setDeals((currentDeals) =>
    currentDeals.map((deal) =>
      deal.id === optimisticDeal.id ? optimisticDeal : deal
    )
  );

  try {
    setIsSavingStage(true);
    setStageError("");
    setStageSuccess("");

    // 2. Send the update to our mock API
    const result = await updateDealStage({
      id: previousDeal.id,
      newStage: selectedStage,
      expectedVersion: previousDeal.version,
    });

    // 3. Handle successful save
    if (result.status === "success") {
      setSelectedDeal(result.deal);

      setDeals((currentDeals) =>
        currentDeals.map((deal) =>
          deal.id === result.deal.id ? result.deal : deal
        )
      );

      setSelectedStage("");
      setStageSuccess("Deal stage updated successfully.");

      // Refresh dashboard metrics
      const updatedDashboard = await getDashboardData("Rahul Sharma");
      setDashboard(updatedDashboard);

      return;
    }

    // 4. Handle version conflict
    if (result.status === "conflict") {
      setSelectedDeal(result.latestDeal);

      setDeals((currentDeals) =>
        currentDeals.map((deal) =>
          deal.id === result.latestDeal.id
            ? result.latestDeal
            : deal
        )
      );

      setSelectedStage("");
      setStageError(
        "This deal was updated by another user. Latest data has been loaded. Please review and try again."
      );

      return;
    }

    // 5. Handle API failure: rollback
    setSelectedDeal(previousDeal);

    setDeals((currentDeals) =>
      currentDeals.map((deal) =>
        deal.id === previousDeal.id ? previousDeal : deal
      )
    );

    setStageError(result.message);
  } catch {
    // Unexpected error: rollback
    setSelectedDeal(previousDeal);

    setDeals((currentDeals) =>
      currentDeals.map((deal) =>
        deal.id === previousDeal.id ? previousDeal : deal
      )
    );

    setStageError("Something went wrong while updating the deal.");
  } finally {
    setIsSavingStage(false);
  }
}


  function handlePipelineStageClick(value: DealStage) {
    setStage((currentStage) =>
      currentStage === value ? "" : value
    );
    setPage(1);
  }

  const dashboardCards = [
    {
      label: "Active deals",
      value: dashboard?.activeDeals ?? 0,
      description: "Deals currently in progress",
      icon: "📁",
      className: "metric-blue",
    },
    {
      label: "Follow-ups today",
      value: dashboard?.dueToday ?? 0,
      description: "Customers to contact today",
      icon: "📅",
      className: "metric-purple",
    },
    {
      label: "Overdue follow-ups",
      value: dashboard?.overdue ?? 0,
      description: "Follow-ups requiring attention",
      icon: "⏰",
      className: "metric-orange",
    },
    {
      label: "Won deals",
      value: dashboard?.wonDeals ?? 0,
      description: "Successfully closed deals",
      icon: "🏆",
      className: "metric-green",
    },
  ];

  const followUps = dashboard?.followUps.slice(0, 5) ?? [];

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDeal || !noteText.trim()) {
      return;
    }
    setIsSavingNote(true);
    setNoteError("");
    try {
      const updatedDeal = await addDealNote(
        selectedDeal.id,
        noteText.trim()
      );
      // Update the open details panel.
      setSelectedDeal(updatedDeal);
      // Update the deal in the table without reloading all 50,000 records.
      setDeals((currentDeals) =>
        currentDeals.map((deal) =>
          deal.id === updatedDeal.id ? updatedDeal : deal
        )
      );
      setNoteText("");
    } catch {
      setNoteError("Could not save note. Please try again.");
    } finally {
      setIsSavingNote(false);
    }
  }

  return (
    <main className="app">
      {/* Header */}
      <header className="top-header">
        <div className="brand">
          <div className="brand-logo">S</div>

          <div>
            <h2>Sales PipeLine</h2>
            <span>CRM Workspace</span>
          </div>
        </div>

        <div className="user-profile">
          <div className="user-avatar">RS</div>

          <div className="user-info">
            <strong>{CURRENT_USER}</strong>
            <span>Sales Representative</span>
          </div>
        </div>
      </header>

      {/* Page heading */}
      <section className="welcome-section">
        <div>
          <h1>My Workspace</h1>
          <p>
            Welcome back, {CURRENT_USER.split(" ")[0]}. Here's your sales
            overview.
          </p>
        </div>

        <span className="workspace-label">My Deals</span>
      </section>

      {/* Dashboard metrics */}
      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Performance Overview</h2>
            <p>Your current sales activity</p>
          </div>
        </div>

        {dashboardError && (
          <p role="alert" className="error-message">
            {dashboardError}
          </p>
        )}

        <div className="metrics-grid">
          {dashboardCards.map((card) => (
            <article
              className={`metric-card ${card.className}`}
              key={card.label}
            >
              <div className="metric-card-top">
                <span>{card.label}</span>
                <span className="metric-icon" aria-hidden="true">
                  {card.icon}
                </span>
              </div>

              <strong className="metric-value">
                {isDashboardLoading ? "—" : card.value.toLocaleString("en-IN")}
              </strong>

              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Pipeline overview */}
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Sales Pipeline</h2>
            <p>
              Track your deals across different sales stages. Select a stage
              to filter your deals.
            </p>
          </div>
        </div>

        <div className="pipeline-grid">
          {DEAL_STAGES.map((dealStage) => {
            const count = dashboard?.stageCounts[dealStage] ?? 0;
            const isSelected = stage === dealStage;

            return (
              <button
                type="button"
                key={dealStage}
                className={`pipeline-card ${isSelected ? "pipeline-card-active" : ""
                  }`}
                onClick={() => handlePipelineStageClick(dealStage)}
                aria-pressed={isSelected}
              >
                <span className="pipeline-stage">{dealStage}</span>

                <strong>
                  {isDashboardLoading ? "—" : count.toLocaleString("en-IN")}
                </strong>

                <span className="pipeline-action">
                  {isSelected ? "Clear filter" : "View deals →"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Follow-ups */}
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Upcoming Follow-ups</h2>
            <p>Customers who need your attention</p>
          </div>

          <span className="section-count">
            {dashboard?.followUps.length ?? 0} follow-ups
          </span>
        </div>

        {isDashboardLoading ? (
          <div className="follow-up-empty">Loading follow-ups...</div>
        ) : followUps.length === 0 ? (
          <div className="follow-up-empty">
            <span>🎉</span>
            <p>No pending follow-ups. You're all caught up!</p>
          </div>
        ) : (
          <div className="follow-up-list">
            {followUps.map((deal) => {
              const status = getFollowUpStatus(deal.nextFollowUpAt!);

              return (
                <article className="follow-up-item" key={deal.id}>
                  <div className="follow-up-main">
                    <strong>{deal.companyName}</strong>
                    <span>{deal.name}</span>
                  </div>

                  <div className="follow-up-date">
                    <span>{formatFollowUpDate(deal.nextFollowUpAt!)}</span>

                    <span
                      className={`status-badge ${status === "Overdue"
                          ? "status-overdue"
                          : "status-today"
                        }`}
                    >
                      {status}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Deals table */}
      <section className="content-section deals-section">
        <div className="section-heading">
          <div>
            <h2>My Deals</h2>
            <p>Search, review and manage your assigned sales deals.</p>
          </div>

          <span className="section-count">
            {total.toLocaleString("en-IN")} deals
          </span>
        </div>

        {/* Filters */}
        <div className="toolbar" aria-label="Deal filters">
          <label className="search-field">
            <span>Search deals</span>

            <input
              type="search"
              placeholder="Search deal or company..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <label className="stage-field">
            <span>Pipeline stage</span>

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

          {stage && (
            <button
              type="button"
              className="clear-filter-button"
              onClick={() => handleStageChange("")}
            >
              Clear filter
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Company</th>
                <th>Owner</th>
                <th>Stage</th>
                <th>Deal value</th>
                <th>Close date</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    Loading deals...
                  </td>
                </tr>
              ) : deals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No matching deals found.
                  </td>
                </tr>
              ) : (
                deals.map((deal) => (

                  <tr
                    key={deal.id}
                 
                     onClick={() => {
                        setSelectedDeal(deal);
                        setSelectedStage("");
                        setStageError("");
                        setStageSuccess("");
                        setNoteText("");
                        setNoteError("");
                        setFollowUpDate("");
                        setFollowUpError("");
                      }}
                                    
                    className="deal-row"
                  >
                    <td>
                      <strong className="deal-name">{deal.name}</strong>
                      <span className="deal-id">{deal.id}</span>
                    </td>

                    <td>{deal.companyName}</td>

                    <td>{deal.ownerName}</td>

                    <td>
                      <span
                        className={`stage-badge stage-${deal.stage
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {deal.stage}
                      </span>
                    </td>

                    <td className="deal-value">
                      {formatCurrency(deal.value, deal.currency)}
                    </td>

                    <td>
                      {deal.closeDate
                        ? new Date(deal.closeDate).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {selectedDeal && (
            <div className="drawer-overlay">
              <div className="deal-drawer">
                <div className="drawer-header">
                  <div>
                    <h2>{selectedDeal.name}</h2>
                    <p>{selectedDeal.companyName}</p>
                  </div>

                  <button
                    onClick={() => setSelectedDeal(null)}
                    className="close-button"
                    aria-label="Close deal details"
                  >
                    x
                  </button>
                </div>

                <div className="deal-details">
                  <div>
                    <span>Deal Value</span>
                    <strong>{formatCurrency(selectedDeal.value, selectedDeal.currency)}</strong>
                  </div>

                  <div>
                    <span>Licence Count</span>
                    <strong>{selectedDeal.licenceCount}</strong>
                  </div>

                  <div>
                    <span>Owner</span>
                    <strong>{selectedDeal.ownerName}</strong>
                  </div>

                  <div>
                    <span>Stage</span>
                    <strong>{selectedDeal.stage}</strong>
                  </div>

                  <div>
                    <span>Close Date</span>
                    <strong>{selectedDeal.closeDate ?? "Not set"}</strong>
                  </div>

                  <div>
                    <span>Last Updated By</span>
                    <strong>{selectedDeal.updatedBy}</strong>
                  </div>

                  <div>
                    <span>Version</span>
                    <strong>{selectedDeal.version}</strong>
                  </div>
                </div>
                 


{/* Stage Update Section */}
<div className="stage-update-section">
  <h3>Update Deal Stage</h3>

  <p>
    Current Stage: <strong>{selectedDeal.stage}</strong>
  </p>

  <label htmlFor="deal-stage">
    Select New Stage
  </label>

  <select
    id="deal-stage"
    value={selectedStage}
    onChange={(event) =>
      setSelectedStage(event.target.value as DealStage | "")
    }
    disabled={isSavingStage}
  >
    <option value="">Select a stage</option>

    {DEAL_STAGES.map((dealStage) => (
      <option key={dealStage} value={dealStage}>
        {dealStage}
      </option>
    ))}
  </select>

  <button
    type="button"
    onClick={handleSaveStage}
    disabled={
      isSavingStage ||
      !selectedStage ||
      selectedStage === selectedDeal.stage
    }
  >
    {isSavingStage ? "Saving..." : "Save Stage"}
  </button>

  {stageError && (
    <p className="stage-error">{stageError}</p>
  )}

  {stageSuccess && (
    <p className="stage-success">{stageSuccess}</p>
  )}
</div>


                <div className="notes-section">
                  <h3>Notes ({selectedDeal.notes.length})</h3>



                    

                    <form onSubmit={handleAddNote} className="note-form">
                      <h4>Add a note</h4>

                      <textarea
                        value={noteText}
                        onChange={(event) => setNoteText(event.target.value)}
                        placeholder="Write your conversation notes..."
                        rows={4}
                        disabled={isSavingNote}
                      />

                      {noteError && (
                        <p className="error-message" role="alert">
                          {noteError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={isSavingNote || !noteText.trim()}
                      >
                        {isSavingNote ? "Saving..." : "Save Note"}
                      </button>
                    </form>

                    <div className="notes-list">
                      {selectedDeal.notes.length === 0 ? (
                        <p>No notes added yet.</p>
                      ) : (
                        selectedDeal.notes.map((note) => (
                          <div key={note.id} className="note-card">
                            <p>{note.text}</p>
                            <small>
                              {note.createdBy} ·{" "}
                              {new Date(note.createdAt).toLocaleString()}
                            </small>
                          </div>
                        ))
                      )}
                    </div>
            

          

                  <div className="follow-up-form">
                    <h3>Next Follow-up</h3>

                    <p>
                      Current:{" "}
                      {selectedDeal.nextFollowUpAt
                        ? formatFollowUpDate(selectedDeal.nextFollowUpAt)
                        : "Not scheduled"}
                    </p>

                    <label htmlFor="follow-up-date">
                      Select date and time
                    </label>

                    <input
                      id="follow-up-date"
                      type="datetime-local"
                      value={followUpDate}
                      onChange={(event) => setFollowUpDate(event.target.value)}
                      disabled={isSavingFollowUp}
                    />

                    {followUpError && (
                      <p className="error-message" role="alert">
                        {followUpError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveFollowUp}
                      disabled={isSavingFollowUp || !followUpDate}
                    >
                      {isSavingFollowUp ? "Saving..." : "Save Follow-up"}
                    </button>
                  </div>

               
                 
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        <footer className="pagination">
          <span>
            {total === 0
              ? "No deals"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(
                page * PAGE_SIZE,
                total
              )} of ${total.toLocaleString("en-IN")}`}
          </span>

          <div className="pagination-controls">
            <button
              type="button"
              disabled={page === 1 || isLoading}
              onClick={() => setPage((currentPage) => currentPage - 1)}
            >
              Previous
            </button>

            <span>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}

export default App;
