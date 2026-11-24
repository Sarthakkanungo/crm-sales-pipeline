import { useCallback, useEffect, useRef, useState } from "react";

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

export function useOverviewToggle() {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const focusAfterToggle = useRef(false);

  useEffect(() => {
    if (focusAfterToggle.current) {
      focusAfterToggle.current = false;
      toggleRef.current?.focus();
    }
  }, [isCollapsed]);

  const toggle = useCallback((options: { keepFocus?: boolean } = {}): void => {
    focusAfterToggle.current = !options.keepFocus;
    setIsCollapsed((current) => {
      writeCollapsed(!current);
      return !current;
    });
  }, []);

  return { isCollapsed, toggle, toggleRef };
}
