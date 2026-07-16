import { useEffect, useRef } from "react";
import {
  parseFeatureDocument,
  serializeFeatureDocument,
  type FeatureDocument,
} from "@spacetech/sfd-lang";

const KEY = "spacetech.featureDoc.v1";

export function loadAutosavedDocument(): FeatureDocument | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return parseFeatureDocument(raw);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(KEY);
}

/** Debounced localStorage persistence for Part Studio feature docs. */
export function useAutosave(doc: FeatureDocument, enabled = true): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, serializeFeatureDocument(doc));
      } catch {
        /* quota / private mode */
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [doc, enabled]);
}
