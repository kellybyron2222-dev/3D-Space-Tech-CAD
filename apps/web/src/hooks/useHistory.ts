import { useCallback, useState } from "react";

type Hist<T> = { stack: T[]; index: number };

/** Simple undo/redo stack for immutable document snapshots. */
export function useHistory<T>(initial: T, limit = 50) {
  const [hist, setHist] = useState<Hist<T>>({ stack: [initial], index: 0 });

  const present = hist.stack[hist.index]!;

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setHist((h) => {
        const cur = h.stack[h.index]!;
        const value =
          typeof next === "function" ? (next as (p: T) => T)(cur) : next;
        const trimmed = h.stack.slice(0, h.index + 1);
        const merged = [...trimmed, value].slice(-limit);
        return { stack: merged, index: merged.length - 1 };
      });
    },
    [limit],
  );

  const undo = useCallback(() => {
    setHist((h) => ({ ...h, index: Math.max(0, h.index - 1) }));
  }, []);

  const redo = useCallback(() => {
    setHist((h) => ({
      ...h,
      index: Math.min(h.stack.length - 1, h.index + 1),
    }));
  }, []);

  const reset = useCallback((value: T) => {
    setHist({ stack: [value], index: 0 });
  }, []);

  return {
    present,
    set,
    undo,
    redo,
    reset,
    canUndo: hist.index > 0,
    canRedo: hist.index < hist.stack.length - 1,
  };
}
