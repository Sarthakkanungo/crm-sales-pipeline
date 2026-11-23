import { useRef, type KeyboardEvent } from "react";
import { formatCount } from "../../../shared/format";
import type { ViewTabCounts } from "../logic/dashboard";
import type { QuickFilter } from "../types/deal.types";

interface ViewTabsProps {
  active: QuickFilter | null;
  counts: ViewTabCounts | null;
  sortedByPriority: boolean;
  onChange: (tab: QuickFilter | null) => void;
}

const TABS: Array<{
  value: QuickFilter | null;
  label: string;
  countKey: keyof ViewTabCounts;
  tone: string;
}> = [
  { value: null, label: "All deals", countKey: "all", tone: "neutral" },
  { value: "active", label: "Active", countKey: "active", tone: "blue" },
  { value: "overdue", label: "Overdue", countKey: "overdue", tone: "red" },
  { value: "dueToday", label: "Due today", countKey: "dueToday", tone: "amber" },
  { value: "updatedToday", label: "Updated today", countKey: "updatedToday", tone: "purple" },
];

export function ViewTabs({ active, counts, sortedByPriority, onChange }: ViewTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = TABS.findIndex((tab) => tab.value === active);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;

    if (step === 0) {
      return;
    }

    event.preventDefault();
    const next = (activeIndex + step + TABS.length) % TABS.length;
    onChange(TABS[next].value);
    tabRefs.current[next]?.focus();
  }

  const priorityNote = !sortedByPriority
    ? null
    : active === "overdue"
      ? "Most overdue first, so work from the top down."
      : active === "dueToday"
        ? "Earliest follow-up first, so work from the top down."
        : null;

  return (
    <div className="view-tabs-row">
      <div
        className="view-tabs"
        role="tablist"
        aria-label="Deal views"
        onKeyDown={handleKeyDown}
      >
        {TABS.map((tab, index) => {
          const isActive = tab.value === active;
          const count = counts?.[tab.countKey];

          return (
            <button
              key={tab.label}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="deals-table"
              tabIndex={isActive ? 0 : -1}
              className={`view-tab tone-${tab.tone}`}
              onClick={() => onChange(tab.value)}
            >
              {tab.label}
              <span className="view-tab-count">
                {count === undefined ? "…" : formatCount(count)}
              </span>
            </button>
          );
        })}
      </div>

      {priorityNote && <p className="view-tabs-note">{priorityNote}</p>}
    </div>
  );
}
