"use client";

import { useEffect, useState } from "react";

export const SEARCH_DEBOUNCE_MS = 300;

// Delay Gateway document search until typing pauses.
// 等输入停顿后再把搜索词交给 Gateway。
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}
