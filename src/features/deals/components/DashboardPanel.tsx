import type { Ref } from "react";
import { formatCount, formatShortInr, stageSlug } from "../../../shared/format";
import { useDealStore } from "../store/dealStore";
import { DEAL_STAGES, type DealStage } from "../types/deal.types";

interface DashboardPanelProps {
  activeStage: DealStage | null;
  isCollapsed: boolean;
  toggleRef: Ref<HTMLButtonElement>;
  onToggle: () => void;
  onStageFilter: (stage: DealStage | null) => void;
  onRetry: () => void;
}

export function DashboardPanel({
  activeStage,
  isCollapsed,
  toggleRef,
  onToggle,
  onStageFilter,
  onRetry,
}: DashboardPanelProps) {
  const dashboard = useDealStore((state) => state.dashboard);
  const status = useDealStore((state) => state.dashboardStatus);
  const scope = useDealStore((state) => state.dashboardScope);
  const isLoading = status === "loading" && !dashboard;

  const show = (value: number | undefined) =>
    isLoading || value === undefined ? "—" : formatCount(value);

  const showAmount = (value: number | undefined) =>
    isLoading || value === undefined ? "—" : formatShortInr(value);

  const errorMessage = status === "error" && (
    <p role="alert" className="error-message">
      Could not load the overview.{" "}
      <button type="button" className="link-button" onClick={onRetry}>
        Retry
      </button>
    </p>
  );

  if (isCollapsed) {
    return errorMessage || null;
  }

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
          ref={toggleRef}
          type="button"
          className="link-button"
          aria-expanded="true"
          aria-controls="overview-body"
          onClick={() => onToggle()}
        >
          Hide overview
        </button>
      </div>

      {errorMessage}

      <div id="overview-body" className="overview-body">
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
    </section>
  );
}
