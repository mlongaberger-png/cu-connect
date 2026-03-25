import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Pull-to-refresh hook. Attaches to document.querySelector('main') by default,
 * or pass a ref to a specific scrollable container.
 */
export default function usePullToRefresh(onRefresh, ref = null) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const refreshingRef = useRef(false);

  const getEl = useCallback(() => {
    if (ref?.current) return ref.current;
    return document.querySelector("main") || document.documentElement;
  }, [ref]);

  useEffect(() => {
    const onTouchStart = (e) => {
      const el = getEl();
      if (el.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchEnd = async (e) => {
      if (!pulling.current) return;
      pulling.current = false;
      const dy = e.changedTouches[0].clientY - startY.current;
      if (dy > 65 && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
        refreshingRef.current = false;
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, getEl]);

  return refreshing;
}