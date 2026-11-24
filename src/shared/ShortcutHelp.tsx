import { useEffect, useRef, type KeyboardEvent } from "react";
import { trapTabKey } from "./focus";

interface ShortcutHelpProps {
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: "↑ ↓  or  j k", action: "Move between deals; the list scrolls with you" },
  { keys: "Home", action: "Go to the first deal from anywhere on the page" },
  { keys: "End", action: "Jump to the last deal in the list" },
  { keys: "↓ in search", action: "Go from the search box to the first result" },
  { keys: "PageUp / PageDown", action: "Move one screen up / down" },
  { keys: "Space  or  x", action: "Select or unselect the focused deal" },
  { keys: "Shift + ↑ ↓", action: "Extend the selection" },
  { keys: "Enter  or  o", action: "Open the focused deal" },
  { keys: "1 – 7", action: "Move the focused deal, or all selected deals, to that stage" },
  { keys: "Shift + 1 – 7", action: "Show only that stage; press again to show all" },
  { keys: "Shift + 0", action: "Show all stages" },
  { keys: "[  /  ]", action: "Previous / next view tab (All, Active, Overdue, Due today, Updated today)" },
  { keys: "Shift + O", action: "Hide or show the overview" },
  { keys: "/", action: "Jump to search" },
  { keys: "Ctrl + Z", action: "Undo the last move" },
  { keys: "Esc", action: "Close a panel, or clear the selection" },
  { keys: "?", action: "Show or hide this help" },
];

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape" || event.key === "?") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    trapTabKey(event, dialogRef.current);
  }

  return (
    <div
      className="drawer-overlay help-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-title"
        onKeyDown={handleKeyDown}
      >
        <div className="drawer-header">
          <h2 id="shortcut-title">Keyboard shortcuts</h2>
          <button
            ref={closeRef}
            type="button"
            className="close-button"
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <dl className="shortcut-list">
          {SHORTCUTS.map((item) => (
            <div key={item.keys}>
              <dt>
                <kbd>{item.keys}</kbd>
              </dt>
              <dd>{item.action}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
