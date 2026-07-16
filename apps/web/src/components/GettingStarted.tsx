import { useState } from "react";

const KEY = "spacetech.gettingStarted.v2";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * First-run explainer: this is editable CAD, not a static 3D viewer.
 */
export function GettingStarted({
  onTryEditHole,
  onStartBlank,
  onDismiss,
}: {
  onTryEditHole: () => void;
  onStartBlank: () => void;
  onDismiss?: () => void;
}) {
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div className="getting-started ux-banner" role="region" aria-label="Getting started">
      <div className="getting-started-main">
        <strong>What you are looking at</strong>
        <p>
          The 3D view is the <em>live result</em> of the feature recipe on the
          left — like Fusion / Onshape, not a fixed model viewer. Bracket-Demo
          is a starter part (plate + hole + fillet) so you have something to
          edit immediately.
        </p>
        <ol className="getting-started-steps">
          <li>
            Choose a tool (<strong>Cut</strong> / <strong>Hole</strong> /{" "}
            <strong>Fillet</strong>) in the toolbar — it stays active.
          </li>
          <li>
            Click the solid (or <strong>Enter</strong>) to place that feature.
          </li>
          <li>
            Click the solid to select Base / Hole / Extrude; drag colored
            handles to reshape.
          </li>
          <li>
            Change <strong>Parameters</strong> or <strong>Properties</strong> for
            precise numbers.
          </li>
        </ol>
        <div className="getting-started-actions">
          <button type="button" className="secondary" onClick={onTryEditHole}>
            Focus hole parameter
          </button>
          <button type="button" className="secondary" onClick={onStartBlank}>
            Start blank part
          </button>
          <button type="button" className="linkish" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
