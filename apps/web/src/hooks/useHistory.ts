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
        if (Object.is(value, cur)) return h;
        const trimmed = h.stack.slice(0, h.index + 1);
        const merged = [...trimmed, value].slice(-limit);
        return { stack: merged, index: merged.length - 1 };
      });
    },
    [limit],
  );

  /** Update present snapshot without pushing a new undo frame. */
  const replacePresent = useCallback((next: T | ((prev: T) => T)) => {
    setHist((h) => {
      const cur = h.stack[h.index]!;
      const value =
        typeof next === "function" ? (next as (p: T) => T)(cur) : next;
      if (Object.is(value, cur)) return h;
      const stack = h.stack.slice();
      stack[h.index] = value;
      return { ...h, stack };
    });
  }, []);

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
    replacePresent,
    undo,
    redo,
    reset,
    canUndo: hist.index > 0,
    canRedo: hist.index < hist.stack.length - 1,
  };
}

export interface PartStudioSnapshot {
  doc: import("@spacetech/sfd-lang").FeatureDocument;
  selectedFeatureId: string | null;
}

/** Undo/redo for Part Studio doc + feature selection kept in sync. */
export function usePartStudioHistory(
  initial: PartStudioSnapshot,
  limit = 50,
) {
  const {
    present,
    set,
    replacePresent,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  } = useHistory(initial, limit);

  const setSnapshot = useCallback(
    (
      next:
        | PartStudioSnapshot
        | ((prev: PartStudioSnapshot) => PartStudioSnapshot),
    ) => {
      set(next);
    },
    [set],
  );

  const setDoc = useCallback(
    (
      next:
        | PartStudioSnapshot["doc"]
        | ((prev: PartStudioSnapshot["doc"]) => PartStudioSnapshot["doc"]),
    ) => {
      set((snap) => {
        const doc =
          typeof next === "function" ? next(snap.doc) : next;
        const selectedFeatureId =
          snap.selectedFeatureId &&
          doc.features.some((f) => f.id === snap.selectedFeatureId)
            ? snap.selectedFeatureId
            : (doc.features[0]?.id ?? null);
        return { doc, selectedFeatureId };
      });
    },
    [set],
  );

  /** Live drag updates — mutates present frame without new undo entries. */
  const replaceDoc = useCallback(
    (
      next:
        | PartStudioSnapshot["doc"]
        | ((prev: PartStudioSnapshot["doc"]) => PartStudioSnapshot["doc"]),
    ) => {
      replacePresent((snap) => {
        const doc =
          typeof next === "function" ? next(snap.doc) : next;
        return { ...snap, doc };
      });
    },
    [replacePresent],
  );

  const setSelectedFeatureId = useCallback(
    (selectedFeatureId: string | null) => {
      replacePresent((snap) => {
        if (snap.selectedFeatureId === selectedFeatureId) return snap;
        return { ...snap, selectedFeatureId };
      });
    },
    [replacePresent],
  );

  const resetDoc = useCallback(
    (doc: PartStudioSnapshot["doc"], selectedFeatureId?: string | null) => {
      reset({
        doc,
        selectedFeatureId:
          selectedFeatureId ?? doc.features[0]?.id ?? null,
      });
    },
    [reset],
  );

  return {
    present,
    doc: present.doc,
    selectedFeatureId: present.selectedFeatureId,
    setSnapshot,
    setDoc,
    replaceDoc,
    setSelectedFeatureId,
    resetDoc,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
