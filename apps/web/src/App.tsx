import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  createEmptyFeatureDocument,
  createReference3UFeatures,
  newFeatureId,
  type BoxFeature,
  type CadFeature,
  type CutFeature,
  type ExtrudeFeature,
  type FeatureDocument,
} from "@spacetech/sfd-lang";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { getCadApi } from "./cad/client";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { DrawingStub } from "./components/DrawingStub";
import { Viewport } from "./components/Viewport";

type DocTab = "part" | "drawing" | "analysis";
type ActiveTool = "select" | "box" | "extrude" | "cut";

function isEditableFeature(
  f: CadFeature | null,
): f is BoxFeature | ExtrudeFeature | CutFeature {
  return f != null && (f.kind === "box" || f.kind === "extrude" || f.kind === "cut");
}

export function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<FeatureDocument>(() => createReference3UFeatures());
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    "f-chassis",
  );
  const [bodySelected, setBodySelected] = useState(false);
  const [mesh, setMesh] = useState<TessellationResult | null>(null);
  /** Imported STEP/STL preview until the next feature rebuild */
  const [importPreview, setImportPreview] = useState<TessellationResult | null>(
    null,
  );
  const [status, setStatus] = useState("Loading kernel…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DocTab>("part");
  const [tool, setTool] = useState<ActiveTool>("select");
  const [fitNonce, setFitNonce] = useState(0);
  const rebuildGen = useRef(0);
  const displayMesh = importPreview ?? mesh;

  const selectedFeature = useMemo(
    () => doc.features.find((f) => f.id === selectedFeatureId) ?? null,
    [doc.features, selectedFeatureId],
  );

  const rebuild = useCallback(async (next: FeatureDocument) => {
    const gen = ++rebuildGen.current;
    setBusy(true);
    setError(null);
    setStatus("Rebuilding…");
    try {
      const cad = getCadApi();
      await cad.ready();
      const result = await cad.rebuildFeatures(next);
      if (gen !== rebuildGen.current) return;
      const tris = result.faces.triangles.length / 3;
      if (!Number.isFinite(tris) || tris <= 0) {
        throw new Error("Empty mesh from rebuild");
      }
      setImportPreview(null);
      setMesh(result);
      setStatus(`${next.name} · ${Math.round(tris).toLocaleString()} triangles`);
      setFitNonce((n) => n + 1);
    } catch (err) {
      if (gen !== rebuildGen.current) return;
      setError(err instanceof Error ? err.message : "Rebuild failed");
      setStatus("Rebuild failed");
      setMesh(null);
    } finally {
      if (gen === rebuildGen.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void rebuild(doc);
  }, [doc, rebuild]);

  function updateFeature(id: string, patch: Partial<CadFeature>) {
    setDoc((prev) => ({
      ...prev,
      features: prev.features.map((f) =>
        f.id === id ? ({ ...f, ...patch } as CadFeature) : f,
      ),
    }));
  }

  function addBox() {
    const id = newFeatureId("box");
    const feature: BoxFeature = {
      id,
      name: `Box ${doc.features.length + 1}`,
      kind: "box",
      widthMm: 60,
      depthMm: 40,
      heightMm: 20,
      zMm: 0,
    };
    setDoc((prev) => ({ ...prev, features: [...prev.features, feature] }));
    setSelectedFeatureId(id);
    setTool("select");
  }

  function addExtrude() {
    const id = newFeatureId("ext");
    const feature: ExtrudeFeature = {
      id,
      name: `Extrude ${doc.features.length + 1}`,
      kind: "extrude",
      plane: "front",
      widthMm: 50,
      heightMm: 30,
      depthMm: 15,
    };
    setDoc((prev) => ({ ...prev, features: [...prev.features, feature] }));
    setSelectedFeatureId(id);
    setTool("select");
  }

  function addCut() {
    const id = newFeatureId("cut");
    const feature: CutFeature = {
      id,
      name: `Cut ${doc.features.length + 1}`,
      kind: "cut",
      plane: "front",
      widthMm: 20,
      heightMm: 20,
      depthMm: 80,
    };
    setDoc((prev) => ({ ...prev, features: [...prev.features, feature] }));
    setSelectedFeatureId(id);
    setTool("select");
  }

  function suppressSelected() {
    if (!selectedFeatureId) return;
    updateFeature(selectedFeatureId, {
      suppressed: !selectedFeature?.suppressed,
    });
  }

  function deleteSelected() {
    if (!selectedFeatureId) return;
    setDoc((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f.id !== selectedFeatureId),
    }));
    setSelectedFeatureId(null);
  }

  function setRollback(index: number | null) {
    setDoc((prev) => ({ ...prev, rollbackIndex: index }));
  }

  async function exportStep() {
    setBusy(true);
    try {
      const blob = await getCadApi().exportFeaturesStep(doc);
      saveAs(blob, `${doc.name.replace(/\s+/g, "_")}.step`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "STEP export failed");
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const cad = getCadApi();
      await cad.ready();
      const result = await cad.importModel(file);
      setImportPreview(result);
      setFitNonce((n) => n + 1);
      setBodySelected(true);
      setStatus(
        `Imported ${file.name} (preview overlay — Box/Extrude/Cut returns to feature solids)`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="cad-app">
      <header className="cad-topbar">
        <div className="cad-brand">
          <strong>SpaceForge</strong>
          <span>Space CAD</span>
        </div>
        <nav className="doc-tabs" aria-label="Document">
          <button
            type="button"
            className={tab === "part" ? "active" : undefined}
            onClick={() => setTab("part")}
          >
            Part
          </button>
          <button
            type="button"
            className={tab === "drawing" ? "active" : undefined}
            onClick={() => setTab("drawing")}
          >
            Drawing
          </button>
          <button
            type="button"
            className={tab === "analysis" ? "active" : undefined}
            onClick={() => setTab("analysis")}
          >
            Analysis
          </button>
        </nav>
        <div className="cad-top-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setDoc(createEmptyFeatureDocument("Part Studio"));
              setSelectedFeatureId(null);
            }}
          >
            New
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              const next = createReference3UFeatures();
              setDoc(next);
              setSelectedFeatureId(next.features[0]?.id ?? null);
            }}
          >
            3U template
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
          <button type="button" disabled={busy} onClick={() => void exportStep()}>
            Export STEP
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".step,.stp,.stl"
            hidden
            onChange={(e) => void onImportFile(e.target.files?.[0])}
          />
        </div>
      </header>

      {tab === "part" ? (
        <>
          <div className="cad-toolbar" role="toolbar" aria-label="Features">
            <button
              type="button"
              className={tool === "select" ? "tool active" : "tool"}
              onClick={() => setTool("select")}
            >
              Select
            </button>
            <button
              type="button"
              className={tool === "box" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => {
                setTool("box");
                addBox();
              }}
            >
              Box
            </button>
            <button
              type="button"
              className={tool === "extrude" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => {
                setTool("extrude");
                addExtrude();
              }}
            >
              Extrude
            </button>
            <button
              type="button"
              className={tool === "cut" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => {
                setTool("cut");
                addCut();
              }}
            >
              Cut
            </button>
            <span className="toolbar-sep" />
            <button
              type="button"
              className="tool"
              disabled={!selectedFeatureId}
              onClick={suppressSelected}
            >
              {selectedFeature?.suppressed ? "Unsuppress" : "Suppress"}
            </button>
            <button
              type="button"
              className="tool"
              disabled={!selectedFeatureId}
              onClick={deleteSelected}
            >
              Delete
            </button>
            <span className="cad-status">
              {busy ? "Rebuilding…" : status}
              {error ? ` · ${error}` : ""}
            </span>
          </div>

          <div className="cad-workspace">
            <aside className="feature-tree" aria-label="Feature tree">
              <div className="tree-head">
                <span>Features</span>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setRollback(null)}
                >
                  End
                </button>
              </div>
              <ul>
                <li className="tree-datum">Origin</li>
                <li className="tree-datum">Front / Top / Right</li>
                {doc.features.map((f, index) => {
                  const rolled =
                    doc.rollbackIndex != null && index > doc.rollbackIndex;
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        className={[
                          "tree-item",
                          f.id === selectedFeatureId ? "selected" : "",
                          f.suppressed ? "suppressed" : "",
                          rolled ? "rolled" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setSelectedFeatureId(f.id)}
                        onDoubleClick={() => setRollback(index)}
                      >
                        <span className="tree-kind">{f.kind}</span>
                        {f.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="tree-hint">
                Click to select. Double-click to roll back to that feature. End
                rebuilds all.
              </p>
              {selectedFeatureId ? (
                <button
                  type="button"
                  className="secondary tree-rollback-btn"
                  onClick={() => {
                    const idx = doc.features.findIndex(
                      (f) => f.id === selectedFeatureId,
                    );
                    if (idx >= 0) setRollback(idx);
                  }}
                >
                  Rollback to selected
                </button>
              ) : null}
            </aside>

            <section className="cad-viewport-wrap">
              <Viewport
                mesh={displayMesh}
                status={status}
                fitNonce={fitNonce}
                onFit={() => setFitNonce((n) => n + 1)}
                selected={bodySelected}
                onSelectBody={() => setBodySelected(true)}
                onClearSelection={() => setBodySelected(false)}
              />
            </section>

            <aside className="props-panel" aria-label="Properties">
              <h2>Properties</h2>
              {!isEditableFeature(selectedFeature) ? (
                <p className="hint">
                  {selectedFeature?.kind === "importBody"
                    ? "Imported body is display-only until fused into history."
                    : bodySelected
                      ? "Body selected. Pick a feature in the tree to edit parameters."
                      : "Select a feature or add Box / Extrude / Cut."}
                </p>
              ) : (
                <FeatureProps
                  feature={selectedFeature}
                  onChange={(patch) => updateFeature(selectedFeature.id, patch)}
                />
              )}
              {bodySelected ? (
                <div className="selection-chip">Body selected</div>
              ) : null}
            </aside>
          </div>
        </>
      ) : null}

      {tab === "drawing" ? <DrawingStub partName={doc.name} /> : null}
      {tab === "analysis" ? <AnalysisPanel /> : null}
    </div>
  );
}

function FeatureProps({
  feature,
  onChange,
}: {
  feature: BoxFeature | ExtrudeFeature | CutFeature;
  onChange: (patch: Partial<CadFeature>) => void;
}) {
  return (
    <div className="props-fields">
      <label className="field">
        <span>Name</span>
        <input
          type="text"
          value={feature.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      {feature.kind === "box" ? (
        <>
          <label className="field">
            <span>Width</span>
            <input
              type="number"
              value={feature.widthMm}
              onChange={(e) => onChange({ widthMm: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Depth</span>
            <input
              type="number"
              value={feature.depthMm}
              onChange={(e) => onChange({ depthMm: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Height</span>
            <input
              type="number"
              value={feature.heightMm}
              onChange={(e) => onChange({ heightMm: Number(e.target.value) })}
            />
          </label>
        </>
      ) : (
        <>
          <label className="field">
            <span>Plane</span>
            <select
              value={feature.plane}
              onChange={(e) =>
                onChange({
                  plane: e.target.value as ExtrudeFeature["plane"],
                })
              }
            >
              <option value="front">Front (XY)</option>
              <option value="top">Top (XZ)</option>
              <option value="right">Right (YZ)</option>
            </select>
          </label>
          <label className="field">
            <span>Width</span>
            <input
              type="number"
              value={feature.widthMm}
              onChange={(e) => onChange({ widthMm: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Height</span>
            <input
              type="number"
              value={feature.heightMm}
              onChange={(e) => onChange({ heightMm: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Depth</span>
            <input
              type="number"
              value={feature.depthMm}
              onChange={(e) => onChange({ depthMm: Number(e.target.value) })}
            />
          </label>
        </>
      )}
    </div>
  );
}
