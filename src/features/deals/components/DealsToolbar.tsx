import type { Ref } from "react";
import { DEAL_STAGES, type DealScope, type DealStage } from "../types/deal.types";

interface DealsToolbarProps {
  searchRef: Ref<HTMLInputElement>;
  searchInput: string;
  stage: DealStage | null;
  scope: DealScope;
  canViewTeam: boolean;
  hasFilters: boolean;
  onSearchChange: (value: string) => void;
  onStageChange: (stage: DealStage | null) => void;
  onScopeChange: (scope: DealScope) => void;
  onClearFilters: () => void;
  onGoToResults: () => void;
}

const SCOPES: Array<{ value: DealScope; label: string }> = [
  { value: "mine", label: "My deals" },
  { value: "all", label: "Whole team" },
];

export function DealsToolbar({
  searchRef,
  searchInput,
  stage,
  scope,
  canViewTeam,
  hasFilters,
  onSearchChange,
  onStageChange,
  onScopeChange,
  onClearFilters,
  onGoToResults,
}: DealsToolbarProps) {
  return (
    <div className="toolbar" role="search" aria-label="Deal filters">
      <label className="search-field">
        <span className="visually-hidden">Search by deal name, company or deal ID (shortcut: /)</span>
        <input
          ref={searchRef}
          type="search"
          placeholder="Search name, company or deal ID   /"
          value={searchInput}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onGoToResults();
              return;
            }

            if (event.key === "Escape" && searchInput) {
              event.stopPropagation();
              onSearchChange("");
            }
          }}
        />
      </label>

      <label className="stage-field">
        <span className="visually-hidden">Stage</span>
        <select
          value={stage ?? ""}
          onChange={(event) =>
            onStageChange((event.target.value || null) as DealStage | null)
          }
        >
          <option value="">All stages</option>
          {DEAL_STAGES.map((item, index) => (
            <option key={item} value={item}>
              {index + 1}. {item}
            </option>
          ))}
        </select>
      </label>

      {canViewTeam && (
        <div className="segmented" role="group" aria-label="Whose deals">
          {SCOPES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={scope === item.value}
              onClick={() => onScopeChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className={`clear-filter-button ${hasFilters ? "" : "is-reserved"}`}
        onClick={onClearFilters}
        disabled={!hasFilters}
        aria-hidden={!hasFilters}
        tabIndex={hasFilters ? 0 : -1}
      >
        Clear filters
      </button>
    </div>
  );
}
