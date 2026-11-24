import { useEffect, useRef } from "react";
import { isTypingTarget } from "../../../shared/focus";
import { runLastUndo } from "../../../shared/toastStore";
import { cancelBulkConfirm, requestBulkMove } from "../actions/bulkActions";
import { EMPTY_SELECTION, selectionCount } from "../logic/selection";
import { useBulkStore } from "../store/bulkStore";
import { useDealStore } from "../store/dealStore";
import { DEAL_STAGES, type DealStage } from "../types/deal.types";

export interface ShortcutActions {
  toggleStage: (stage: DealStage | null) => void;
  toggleOverview: () => void;
  stepView: (step: 1 | -1) => void;
  focusSearch: () => void;
  openHelp: () => void;
  moveByScreen: (direction: 1 | -1) => void;
  focusFirstRow: () => void;
}

export function useGlobalShortcuts(enabled: boolean, actions: ShortcutActions): void {
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      const run = actionsRef.current;
      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z";

      if (isUndo) {
        if (!isTypingTarget(event.target) && runLastUndo()) {
          event.preventDefault();
        }
        return;
      }

      if (isTypingTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const stageShortcut = /^Digit([0-7])$/.exec(event.code);

      if (event.shiftKey && stageShortcut) {
        event.preventDefault();
        run.toggleStage(DEAL_STAGES[Number(stageShortcut[1]) - 1] ?? null);
        return;
      }

      if (event.shiftKey && event.code === "KeyO") {
        event.preventDefault();
        run.toggleOverview();
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        run.focusSearch();
      } else if (event.key === "?") {
        event.preventDefault();
        run.openHelp();
      } else if (event.key === "Escape") {
        if (useBulkStore.getState().confirm) {
          cancelBulkConfirm();
        } else {
          useDealStore.getState().setSelection(EMPTY_SELECTION);
        }
      } else if (
        (event.key === "PageDown" || event.key === "PageUp") &&
        !event.defaultPrevented
      ) {
        event.preventDefault();
        run.moveByScreen(event.key === "PageDown" ? 1 : -1);
      } else if (event.key === "Home" && !event.defaultPrevented) {
        event.preventDefault();
        run.focusFirstRow();
      } else if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        run.stepView(event.key === "]" ? 1 : -1);
      } else if (
        !event.defaultPrevented &&
        selectionCount(useDealStore.getState().selection) > 0
      ) {
        const stage = DEAL_STAGES[Number(event.key) - 1];

        if (stage) {
          event.preventDefault();
          requestBulkMove(stage);
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
