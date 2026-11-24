import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { sessionStore } from "../../session/sessionStore";
import type { DealsTableHandle } from "../components/DealsTable";

interface OpenDrawer {
  dealId: string;
  openedAt: number;
}

export function useDealDrawer(tableRef: RefObject<DealsTableHandle | null>) {
  const [drawer, setDrawer] = useState<OpenDrawer | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const keepIdsRef = useRef<string[]>([]);

  useEffect(() => {
    keepIdsRef.current = drawer ? [drawer.dealId] : [];
  }, [drawer]);

  useEffect(
    () =>
      sessionStore.subscribe((next, previous) => {
        if (next.role !== previous.role) {
          setDrawer(null);
        }
      }),
    []
  );

  const openDrawer = useCallback((dealId: string) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDrawer({ dealId, openedAt: Date.now() });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer(null);

    const returnTo = returnFocusRef.current;

    requestAnimationFrame(() => {
      if (returnTo?.isConnected) {
        returnTo.focus();
      } else {
        tableRef.current?.focusActiveRow();
      }
    });
  }, [tableRef]);

  return { drawer, openDrawer, closeDrawer, keepIdsRef };
}
