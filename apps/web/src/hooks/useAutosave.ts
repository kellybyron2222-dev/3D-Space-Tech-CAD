import { useEffect, useRef } from "react";
import {
  parseFeatureDocument,
  serializeFeatureDocument,
  type CadFeature,
  type FeatureDocument,
} from "@spacetech/sfd-lang";

const KEY = "spacetech.featureDoc.v1";

const FEATURE_KINDS = new Set<CadFeature["kind"]>([
  "box",
  "sketch",
  "extrude",
  "cut",
  "revolve",
  "fillet",
  "chamfer",
  "hole",
  "mirror",
  "linearPattern",
  "importBody",
]);

/** Basic structural validation before restoring autosaved / shared docs. */
export function isRestorableFeatureDocument(
  doc: unknown,
): doc is FeatureDocument {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as FeatureDocument;
  if (d.version !== 1 || typeof d.name !== "string") return false;
  if (!Array.isArray(d.features)) return false;
  if (d.features.length === 0) return false;
  return d.features.every(
    (f) =>
      f &&
      typeof f === "object" &&
      typeof f.id === "string" &&
      typeof f.name === "string" &&
      typeof f.kind === "string" &&
      FEATURE_KINDS.has(f.kind as CadFeature["kind"]),
  );
}

export function loadAutosavedDocument(): FeatureDocument | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = parseFeatureDocument(raw);
    if (!isRestorableFeatureDocument(parsed)) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(KEY);
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
    if (!isRestorableFeatureDocument(doc)) return;
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
