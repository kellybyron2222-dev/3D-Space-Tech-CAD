import { useMemo, useState } from "react";
import { activeFeatures, type FeatureDocument } from "@spacetech/sfd-lang";

const DISMISS_KEY = "spacetech.exitCoach.dismissed";

export function isExitCoachDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* quota / private mode */
  }
}

type ChecklistItem =
  | { id: string; label: string; done: boolean; action?: "assembly" | "drawing" }
  | { id: string; label: string; tip: string };

function buildChecklist(
  doc: FeatureDocument,
  assemblyDone: boolean,
  drawingDone: boolean,
): ChecklistItem[] {
  const features = activeFeatures(doc);
  const kinds = new Set(features.map((f) => f.kind));

  return [
    {
      id: "wall",
      label: "Wall / base solid",
      done: kinds.has("box") || kinds.has("extrude"),
    },
    {
      id: "hole",
      label: "Hole",
      done: kinds.has("hole") || kinds.has("cut"),
    },
    {
      id: "fillet",
      label: "Fillet",
      done: kinds.has("fillet"),
    },
    {
      id: "assembly",
      label: "Assembly",
      done: assemblyDone,
      action: "assembly",
    },
    {
      id: "drawing",
      label: "Drawing",
      done: drawingDone,
      action: "drawing",
    },
    {
      id: "step",
      label: "STEP export",
      tip: "Export STEP from top bar",
    },
  ];
}

function completedCount(items: ChecklistItem[]): number {
  return items.filter((item) => "done" in item && item.done).length;
}

export function ExitCoach({
  doc,
  onGoAssembly,
  onGoDrawing,
  onDismiss,
}: {
  doc: FeatureDocument;
  onGoAssembly: () => void;
  onGoDrawing: () => void;
  onDismiss: () => void;
}) {
  const [dismissed, setDismissed] = useState(isExitCoachDismissed);
  const [assemblyDone, setAssemblyDone] = useState(false);
  const [drawingDone, setDrawingDone] = useState(false);

  const items = useMemo(
    () => buildChecklist(doc, assemblyDone, drawingDone),
    [doc, assemblyDone, drawingDone],
  );
  const done = completedCount(items);
  const total = items.length;

  if (dismissed) return null;

  function handleDismiss() {
    persistDismiss();
    setDismissed(true);
    onDismiss();
  }

  function handleAssembly() {
    setAssemblyDone(true);
    onGoAssembly();
  }

  function handleDrawing() {
    setDrawingDone(true);
    onGoDrawing();
  }

  return (
    <div
      className="exit-coach ux-banner"
      role="region"
      aria-label="Exit test checklist"
    >
      <div className="exit-coach-main">
        <div className="exit-coach-head">
          <strong>
            Exit test {done}/{total}
          </strong>
          <span className="exit-coach-sub">
            Wall + hole + fillet → assembly → drawing → STEP
          </span>
        </div>
        <ol className="exit-coach-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={
                "tip" in item
                  ? "exit-coach-item exit-coach-item--tip"
                  : item.done
                    ? "exit-coach-item exit-coach-item--done"
                    : "exit-coach-item"
              }
            >
              {"tip" in item ? (
                <>
                  <span className="exit-coach-marker" aria-hidden>
                    ·
                  </span>
                  <span className="exit-coach-label">{item.label}</span>
                  <span className="selection-chip">{item.tip}</span>
                </>
              ) : (
                <>
                  <span
                    className="exit-coach-marker"
                    aria-hidden
                    title={item.done ? "Done" : "Pending"}
                  >
                    {item.done ? "✓" : "○"}
                  </span>
                  <span className="exit-coach-label">{item.label}</span>
                  {item.action === "assembly" && !item.done ? (
                    <button
                      type="button"
                      className="secondary exit-coach-action"
                      onClick={handleAssembly}
                    >
                      Open Assembly
                    </button>
                  ) : null}
                  {item.action === "drawing" && !item.done ? (
                    <button
                      type="button"
                      className="secondary exit-coach-action"
                      onClick={handleDrawing}
                    >
                      Open Drawing
                    </button>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
      <button type="button" className="linkish exit-coach-dismiss" onClick={handleDismiss}>
        Dismiss
      </button>
    </div>
  );
}
