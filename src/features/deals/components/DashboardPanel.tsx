import { useState } from "react";
import { formatCount, formatShortInr, stageSlug } from "../../../shared/format";
import { useDealStore } from "../store/dealStore";
import { DEAL_STAGES, type DealStage, type QuickFilter } from "../types/deal.types";

interface DashboardPanelProps {
  activeStage: DealStage | null;
  activeQuickFilter: QuickFilter | null;
  onStageFilter: (stage: DealStage | null) => void;
  onQuickFilter: (filter: QuickFilter | null) => void;
  onRetry: () => void;
}

const COLLAPSED_KEY = "pipeline.overviewCollapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, String(value));
  } catch {
    return;
  }
}

export function DashboardPanel({
  activeStage,
  activeQuickFilter,
  onStageFilter,
  onQuickFilter,
  onRetry,
}: DashboardPanelProps) {
  const dashboard = useDealStore((state) => state.dashboard);
  const status = useDealStore((state) => state.dashboardStatus);
  const scope = useDealStore((state) => state.dashboardScope);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const isLoading = status === "loading" && !dashboard;

  const show = (value: number | undefined) =>
    isLoading || value === undefined ? "—" : formatCount(value);

  const showAmount = (value: number | undefined) =>
    isLoading || value === undefined ? "—" : formatShortInr(value);

  function toggleCollapsed(): void {
    setIsCollapsed((current) => {
      writeCollapsed(!current);
      return !current;
    });
  }

  const kpis: Array<{
    label: string;
    value: number | undefined;
    amount: number | undefined;
    className: string;
    pressed: boolean;
    onClick: () => void;
  }> = [
    {
      label: "Overdue",
      value: dashboard?.overdue,
      amount: dashboard?.overdueValue,
      className: "metric-red",
      pressed: activeQuickFilter === "overdue",
      onClick: () => onQuickFilter(activeQuickFilter === "overdue" ? null : "overdue"),
    },
    {
      label: "Due today",
      value: dashboard?.dueToday,
      amount: dashboard?.dueTodayValue,
      className: "metric-amber",
      pressed: activeQuickFilter === "dueToday",
      onClick: () => onQuickFilter(activeQuickFilter === "dueToday" ? null : "dueToday"),
    },
    {
      label: "Active",
      value: dashboard?.activeDeals,
      amount: dashboard?.activeValue,
      className: "metric-blue",
      pressed: activeQuickFilter === "active",
      onClick: () => onQuickFilter(activeQuickFilter === "active" ? null : "active"),
    },
    {
      label: "Won",
      value: dashboard?.wonDeals,
      amount: dashboard?.stageValues.Won,
      className: "metric-green",
      pressed: activeStage === "Won",
      onClick: () => onStageFilter(activeStage === "Won" ? null : "Won"),
    },
  ];

  return (
    <section className="overview" aria-labelledby="overview-heading">
      <div className="overview-header">
        <h2 id="overview-heading">
          Overview
          <span className="overview-scope">
            {scope === "mine" ? "Your deals" : "Whole team"}
          </span>
        </h2>

        <button
          type="button"
          className="link-button"
          aria-expanded={!isCollapsed}
          aria-controls="overview-body"
          onClick={toggleCollapsed}
        >
          {isCollapsed ? "Show overview" : "Hide overview"}
        </button>
      </div>

      {status === "error" && (
        <p role="alert" className="error-message">
          Could not load the overview.{" "}
          <button type="button" className="link-button" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}

      {!isCollapsed && (
        <div id="overview-body" className="overview-body">
          <div className="kpi-row">
            {kpis.map((kpi) => (
              <button
                type="button"
                key={kpi.label}
                className={`kpi metric-card ${kpi.className} ${kpi.pressed ? "metric-card-active" : ""}`}
                aria-pressed={kpi.pressed}
                onClick={kpi.onClick}
              >
                <span className="kpi-text">
                  <span className="kpi-label">{kpi.label}</span>
                  <span className="kpi-amount">{showAmount(kpi.amount)}</span>
                </span>
                <strong className="metric-value">{show(kpi.value)}</strong>
              </button>
            ))}
          </div>

          <div className="stage-strip" role="group" aria-label="Deals per stage">
            {DEAL_STAGES.map((stage, index) => {
              const isSelected = activeStage === stage;

              return (
                <button
                  type="button"
                  key={stage}
                  className={`stage-chip pipeline-card accent-${stageSlug(stage)} ${isSelected ? "pipeline-card-active" : ""}`}
                  onClick={() => onStageFilter(isSelected ? null : stage)}
                  aria-pressed={isSelected}
                  title={isSelected ? "Clear stage filter" : `Show ${stage} deals`}
                >
                  <span className="stage-chip-text">
                    <span className="pipeline-stage">
                      {index + 1}. {stage}
                    </span>
                    <span className="stage-chip-amount">
                      {showAmount(dashboard?.stageValues[stage])}
                    </span>
                  </span>
                  <strong>{show(dashboard?.stageCounts[stage])}</strong>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
