import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  applyParameters,
  createBracketDemo,
  createEmptyFeatureDocument,
  createReference3UFeatures,
  newFeatureId,
  parseFeatureDocument,
  serializeFeatureDocument,
  type BoxFeature,
  type CadFeature,
  type ChamferFeature,
  type CutFeature,
  type ExtrudeFeature,
  type FeatureDocument,
  type FilletFeature,
  type HoleFeature,
  type LinearPatternFeature,
  type MirrorFeature,
  type RevolveFeature,
  type SketchFeature,
} from "@spacetech/sfd-lang";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { getCadApi } from "./cad/client";
import { copyShareUrl, decodeShareHash, encodeShareHash } from "./cad/shareLink";
import type { MassPropsResult } from "./cad/types";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { AssemblyPanel } from "./components/AssemblyPanel";
import { DrawingPanel } from "./components/DrawingPanel";
import { Viewport } from "./components/Viewport";
import { loadAutosavedDocument, useAutosave } from "./hooks/useAutosave";
import { useHistory } from "./hooks/useHistory";

function initialDocument(): FeatureDocument {
  const fromHash = decodeShareHash(window.location.hash);
  if (fromHash) return fromHash;
  return loadAutosavedDocument() ?? createBracketDemo();
}

type DocTab = "part" | "assembly" | "drawing" | "analysis";

function isEditableFeature(f: CadFeature | null): f is CadFeature {
  return f != null && f.kind !== "importBody";
}

export function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const history = useHistory<FeatureDocument>(initialDocument());
  const doc = history.present;
  useAutosave(doc);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    doc.features[0]?.id ?? null,
  );
  const [bodySelected, setBodySelected] = useState(false);
  const [measureMm, setMeasureMm] = useState<number | null>(null);
  const [measureBox, setMeasureBox] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [faceIndex, setFaceIndex] = useState<number | null>(null);
  const [mesh, setMesh] = useState<TessellationResult | null>(null);
  const [mass, setMass] = useState<MassPropsResult | null>(null);
  const [importPreview, setImportPreview] = useState<TessellationResult | null>(
    null,
  );
  const [status, setStatus] = useState("Loading kernel…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DocTab>("part");
  const [fitNonce, setFitNonce] = useState(0);
  const [uxNote, setUxNote] = useState<string | null>(null);
  const rebuildGen = useRef(0);
  const displayMesh = importPreview ?? mesh;

  const selectedFeature = useMemo(
    () => doc.features.find((f) => f.id === selectedFeatureId) ?? null,
    [doc.features, selectedFeatureId],
  );

  const sketchGhost = useMemo(() => {
    if (selectedFeature?.kind !== "sketch") return null;
    return {
      plane: selectedFeature.plane,
      profile: selectedFeature.profile,
      widthMm: selectedFeature.widthMm,
      heightMm: selectedFeature.heightMm,
      offsetUMm: selectedFeature.offsetUMm,
      offsetVMm: selectedFeature.offsetVMm,
    };
  }, [selectedFeature]);

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
      const tris = result.mesh.faces.triangles.length / 3;
      if (!Number.isFinite(tris) || tris <= 0) {
        throw new Error("Empty mesh from rebuild");
      }
      setImportPreview(null);
      setMesh(result.mesh);
      setMass(result.mass);
      setStatus(
        `${next.name} · ${Math.round(tris).toLocaleString()} tris · ${result.mass.massKg.toFixed(3)} kg (Al L0)`,
      );
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        history.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history]);

  function updateFeature(id: string, patch: Partial<CadFeature>) {
    history.set((prev) => ({
      ...prev,
      features: prev.features.map((f) =>
        f.id === id ? ({ ...f, ...patch } as CadFeature) : f,
      ),
    }));
  }

  function addFeature(feature: CadFeature) {
    history.set((prev) => ({
      ...prev,
      features: [...prev.features, feature],
    }));
    setSelectedFeatureId(feature.id);
    setUxNote(`Added ${feature.kind}: ${feature.name}`);
  }

  function addSketch() {
    const id = newFeatureId("sk");
    const feature: SketchFeature = {
      id,
      name: `Sketch ${doc.features.filter((f) => f.kind === "sketch").length + 1}`,
      kind: "sketch",
      plane: "front",
      profile: "rect",
      widthMm: 40,
      heightMm: 30,
      constraints: [
        { kind: "horizontal" },
        { kind: "vertical" },
        { kind: "dimension", valueMm: 40, label: "width" },
        { kind: "dimension", valueMm: 30, label: "height" },
      ],
    };
    addFeature(feature);
  }

  function addExtrudeFromSketch() {
    const sketch = [...doc.features]
      .reverse()
      .find((f): f is SketchFeature => f.kind === "sketch");
    const id = newFeatureId("ext");
    const feature: ExtrudeFeature = {
      id,
      name: `Extrude ${doc.features.length + 1}`,
      kind: "extrude",
      sketchId: sketch?.id,
      plane: sketch?.plane ?? "front",
      profile: sketch?.profile ?? "rect",
      widthMm: sketch?.widthMm ?? 40,
      heightMm: sketch?.heightMm ?? 30,
      depthMm: 12,
      offsetUMm: sketch?.offsetUMm,
      offsetVMm: sketch?.offsetVMm,
    };
    addFeature(feature);
  }

  function addBox() {
    const id = newFeatureId("box");
    addFeature({
      id,
      name: `Box ${doc.features.length + 1}`,
      kind: "box",
      widthMm: 60,
      depthMm: 40,
      heightMm: 20,
    } satisfies BoxFeature);
  }

  function addCut() {
    const sketch = [...doc.features]
      .reverse()
      .find((f): f is SketchFeature => f.kind === "sketch");
    const id = newFeatureId("cut");
    addFeature({
      id,
      name: `Cut ${doc.features.length + 1}`,
      kind: "cut",
      sketchId: sketch?.id,
      plane: sketch?.plane ?? "front",
      profile: sketch?.profile ?? "rect",
      widthMm: sketch?.widthMm ?? 20,
      heightMm: sketch?.heightMm ?? 20,
      depthMm: 80,
      offsetUMm: sketch?.offsetUMm,
      offsetVMm: sketch?.offsetVMm,
    } satisfies CutFeature);
  }

  function addHole() {
    const id = newFeatureId("hole");
    addFeature({
      id,
      name: `Hole ${doc.features.length + 1}`,
      kind: "hole",
      diameterMm: 6,
      depthMm: 20,
      xMm: 15,
      yMm: 10,
      zMm: 0,
    } satisfies HoleFeature);
  }

  function addFillet() {
    const id = newFeatureId("fil");
    addFeature({
      id,
      name: `Fillet ${doc.features.length + 1}`,
      kind: "fillet",
      radiusMm: 2,
    } satisfies FilletFeature);
  }

  function addChamfer() {
    const id = newFeatureId("chm");
    addFeature({
      id,
      name: `Chamfer ${doc.features.length + 1}`,
      kind: "chamfer",
      distanceMm: 1.5,
    } satisfies ChamferFeature);
  }

  function addRevolve() {
    const id = newFeatureId("rev");
    addFeature({
      id,
      name: `Revolve ${doc.features.length + 1}`,
      kind: "revolve",
      plane: "front",
      profile: "circle",
      widthMm: 10,
      heightMm: 10,
      angleDeg: 360,
      offsetUMm: 20,
    } satisfies RevolveFeature);
  }

  function addMirror() {
    const id = newFeatureId("mir");
    addFeature({
      id,
      name: `Mirror ${doc.features.length + 1}`,
      kind: "mirror",
      plane: "right",
    } satisfies MirrorFeature);
  }

  function addLinearPattern() {
    const id = newFeatureId("pat");
    addFeature({
      id,
      name: `Pattern ${doc.features.length + 1}`,
      kind: "linearPattern",
      count: 3,
      dxMm: 25,
      dyMm: 0,
      dzMm: 0,
    } satisfies LinearPatternFeature);
  }

  function moveSelected(dir: -1 | 1) {
    if (!selectedFeatureId) return;
    history.set((prev) => {
      const idx = prev.features.findIndex((f) => f.id === selectedFeatureId);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.features.length) return prev;
      const features = [...prev.features];
      const [item] = features.splice(idx, 1);
      features.splice(j, 0, item!);
      return { ...prev, features };
    });
  }

  function suppressSelected() {
    if (!selectedFeatureId || !selectedFeature) return;
    updateFeature(selectedFeatureId, {
      suppressed: !selectedFeature.suppressed,
    });
  }

  function deleteSelected() {
    if (!selectedFeatureId) return;
    history.set((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f.id !== selectedFeatureId),
    }));
    setSelectedFeatureId(null);
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

  async function exportStl() {
    setBusy(true);
    try {
      const blob = await getCadApi().exportFeaturesStl(doc);
      saveAs(blob, `${doc.name.replace(/\s+/g, "_")}.stl`);
      setUxNote("Exported STL from feature history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "STL export failed");
    } finally {
      setBusy(false);
    }
  }

  function shareLink() {
    copyShareUrl(doc);
    window.history.replaceState(null, "", encodeShareHash(doc));
    setUxNote("Share link copied to clipboard");
  }

  function saveProject() {
    const blob = new Blob([serializeFeatureDocument(doc)], {
      type: "application/json",
    });
    saveAs(blob, `${doc.name.replace(/\s+/g, "_")}.sfd.json`);
  }

  async function loadProject(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const next = parseFeatureDocument(text);
      history.reset(next);
      setSelectedFeatureId(next.features[0]?.id ?? null);
      setUxNote(`Opened ${file.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid project");
    } finally {
      if (projectRef.current) projectRef.current.value = "";
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const cad = getCadApi();
      await cad.ready();
      const result = await cad.importModel(file);
      setImportPreview(result);
      setFitNonce((n) => n + 1);
      setBodySelected(true);
      setStatus(`Imported ${file.name} (preview overlay)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onSelectBody() {
    setBodySelected(true);
    if (mesh?.faces.vertices.length) {
      const v = mesh.faces.vertices;
      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < v.length; i += 3) {
        minX = Math.min(minX, v[i]!);
        minY = Math.min(minY, v[i + 1]!);
        minZ = Math.min(minZ, v[i + 2]!);
        maxX = Math.max(maxX, v[i]!);
        maxY = Math.max(maxY, v[i + 1]!);
        maxZ = Math.max(maxZ, v[i + 2]!);
      }
      const dx = maxX - minX;
      const dy = maxY - minY;
      const dz = maxZ - minZ;
      setMeasureBox({ x: dx, y: dy, z: dz });
      setMeasureMm(Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
  }

  return (
    <div className="cad-app">
      <header className="cad-topbar">
        <div className="cad-brand">
          <strong>SpaceForge</strong>
          <span>Space CAD · preview</span>
        </div>
        <nav className="doc-tabs" aria-label="Document">
          {(
            [
              ["part", "Part"],
              ["assembly", "Assembly"],
              ["drawing", "Drawing"],
              ["analysis", "Analysis"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="cad-top-actions">
          <button
            type="button"
            className="secondary"
            disabled={!history.canUndo}
            onClick={() => history.undo()}
          >
            Undo
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!history.canRedo}
            onClick={() => history.redo()}
          >
            Redo
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              history.reset(createEmptyFeatureDocument());
              setSelectedFeatureId(null);
            }}
          >
            New
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const next = createBracketDemo();
              history.reset(next);
              setSelectedFeatureId(next.features[0]?.id ?? null);
              setUxNote("Loaded Bracket-Demo (table-stakes path)");
            }}
          >
            Bracket demo
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const next = createReference3UFeatures();
              history.reset(next);
              setSelectedFeatureId(next.features[0]?.id ?? null);
            }}
          >
            3U template
          </button>
          <button type="button" className="secondary" onClick={saveProject}>
            Save
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => projectRef.current?.click()}
          >
            Open
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
          <button type="button" disabled={busy} onClick={() => void exportStep()}>
            Export STEP
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void exportStl()}
          >
            Export STL
          </button>
          <button type="button" className="secondary" onClick={shareLink}>
            Share
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".step,.stp,.stl"
            hidden
            onChange={(e) => void onImportFile(e.target.files?.[0])}
          />
          <input
            ref={projectRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void loadProject(e.target.files?.[0])}
          />
        </div>
      </header>

      {uxNote ? (
        <div className="ux-banner" role="status">
          {uxNote}
          <button type="button" className="linkish" onClick={() => setUxNote(null)}>
            dismiss
          </button>
        </div>
      ) : null}

      {tab === "part" ? (
        <>
          <div className="cad-toolbar" role="toolbar">
            <button type="button" className="tool" disabled={busy} onClick={addSketch}>
              Sketch
            </button>
            <button
              type="button"
              className="tool"
              disabled={busy}
              onClick={addExtrudeFromSketch}
            >
              Extrude
            </button>
            <button type="button" className="tool" disabled={busy} onClick={addBox}>
              Box
            </button>
            <button type="button" className="tool" disabled={busy} onClick={addCut}>
              Cut
            </button>
            <button type="button" className="tool" disabled={busy} onClick={addHole}>
              Hole
            </button>
            <button type="button" className="tool" disabled={busy} onClick={addRevolve}>
              Revolve
            </button>
            <button type="button" className="tool" disabled={busy} onClick={addFillet}>
              Fillet
            </button>
            <button type="button" className="tool" disabled={busy} onClick={addChamfer}>
              Chamfer
            </button>
            <button type="button" className="tool" disabled={busy} onClick={addMirror}>
              Mirror
            </button>
            <button
              type="button"
              className="tool"
              disabled={busy}
              onClick={addLinearPattern}
            >
              Pattern
            </button>
            <span className="toolbar-sep" />
            <button
              type="button"
              className="tool"
              disabled={!selectedFeatureId}
              onClick={() => moveSelected(-1)}
              title="Move feature up"
            >
              ↑
            </button>
            <button
              type="button"
              className="tool"
              disabled={!selectedFeatureId}
              onClick={() => moveSelected(1)}
              title="Move feature down"
            >
              ↓
            </button>
            <button
              type="button"
              className="tool"
              disabled={!selectedFeatureId}
              onClick={suppressSelected}
            >
              Suppress
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
            <aside className="feature-tree">
              <div className="tree-head">
                <span>Features</span>
                <button
                  type="button"
                  className="linkish"
                  onClick={() =>
                    history.set((p) => ({ ...p, rollbackIndex: null }))
                  }
                >
                  End
                </button>
              </div>
              <ul>
                <li className="tree-datum">Origin · Front/Top/Right</li>
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
                        onDoubleClick={() =>
                          history.set((p) => ({ ...p, rollbackIndex: index }))
                        }
                      >
                        <span className="tree-kind">{f.kind}</span>
                        {f.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="tree-hint">
                Sketch → Extrude for profiles. Double-click = rollback. Ctrl+Z
                undo.
              </p>
            </aside>

            <section className="cad-viewport-wrap">
              <Viewport
                mesh={displayMesh}
                status={status}
                fitNonce={fitNonce}
                onFit={() => setFitNonce((n) => n + 1)}
                selected={bodySelected}
                onSelectBody={onSelectBody}
                onClearSelection={() => {
                  setBodySelected(false);
                  setMeasureMm(null);
                  setMeasureBox(null);
                  setFaceIndex(null);
                }}
                sketchGhost={sketchGhost}
                faceIndex={faceIndex}
                onFaceIndex={setFaceIndex}
              />
            </section>

            <aside className="props-panel">
              <h2>Properties</h2>
              {faceIndex != null ? (
                <div className="selection-chip">Face group #{faceIndex}</div>
              ) : null}
              <div className="params-block">
                <h2>Parameters</h2>
                {Object.keys(doc.parameters ?? {}).length === 0 ? (
                  <p className="hint">No named params on this part.</p>
                ) : (
                  Object.entries(doc.parameters ?? {}).map(([key, val]) => (
                    <label className="field" key={key}>
                      <span>{key}</span>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          history.set((prev) =>
                            applyParameters({
                              ...prev,
                              parameters: { ...prev.parameters, [key]: n },
                            }),
                          );
                        }}
                      />
                    </label>
                  ))
                )}
              </div>
              {mass ? (
                <div className="mass-block">
                  <div className="stat">
                    <span>Mass (Al L0)</span>
                    <span>{mass.massKg.toFixed(4)} kg</span>
                  </div>
                  <div className="stat">
                    <span>Volume</span>
                    <span>{mass.volumeMm3.toFixed(0)} mm³</span>
                  </div>
                  <div className="stat">
                    <span>CG</span>
                    <span>
                      {mass.cgMm.x.toFixed(1)}, {mass.cgMm.y.toFixed(1)},{" "}
                      {mass.cgMm.z.toFixed(1)}
                    </span>
                  </div>
                </div>
              ) : null}
              {measureBox != null ? (
                <div className="selection-chip">
                  Measure bbox {measureBox.x.toFixed(2)} ×{" "}
                  {measureBox.y.toFixed(2)} × {measureBox.z.toFixed(2)} mm
                  {measureMm != null
                    ? ` · diag ${measureMm.toFixed(2)} mm`
                    : ""}
                </div>
              ) : null}
              {!selectedFeature || !isEditableFeature(selectedFeature) ? (
                <p className="hint">Select a feature or add Sketch / Extrude.</p>
              ) : (
                <FeatureProps
                  feature={selectedFeature}
                  onChange={(patch) =>
                    updateFeature(selectedFeature.id, patch)
                  }
                />
              )}
            </aside>
          </div>
        </>
      ) : null}

      {tab === "assembly" ? <AssemblyPanel partDoc={doc} /> : null}
      {tab === "drawing" ? (
        <DrawingPanel partName={doc.name} mesh={displayMesh} />
      ) : null}
      {tab === "analysis" ? <AnalysisPanel /> : null}
    </div>
  );
}

function FeatureProps({
  feature,
  onChange,
}: {
  feature: CadFeature;
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
          <Num
            label="Width"
            value={feature.widthMm}
            onChange={(v) => onChange({ widthMm: v })}
          />
          <Num
            label="Depth"
            value={feature.depthMm}
            onChange={(v) => onChange({ depthMm: v })}
          />
          <Num
            label="Height"
            value={feature.heightMm}
            onChange={(v) => onChange({ heightMm: v })}
          />
        </>
      ) : null}
      {feature.kind === "sketch" ||
      feature.kind === "extrude" ||
      feature.kind === "cut" ||
      feature.kind === "revolve" ? (
        <>
          <label className="field">
            <span>Plane</span>
            <select
              value={feature.plane}
              onChange={(e) =>
                onChange({ plane: e.target.value as SketchFeature["plane"] })
              }
            >
              <option value="front">Front</option>
              <option value="top">Top</option>
              <option value="right">Right</option>
            </select>
          </label>
          {"profile" in feature ? (
            <label className="field">
              <span>Profile</span>
              <select
                value={feature.profile}
                onChange={(e) =>
                  onChange({
                    profile: e.target.value as SketchFeature["profile"],
                  })
                }
              >
                <option value="rect">Rect</option>
                <option value="circle">Circle</option>
              </select>
            </label>
          ) : null}
          <Num
            label={feature.profile === "circle" ? "Dia" : "Width"}
            value={feature.widthMm}
            onChange={(v) => onChange({ widthMm: v })}
          />
          {feature.profile !== "circle" ? (
            <Num
              label="Height"
              value={feature.heightMm}
              onChange={(v) => onChange({ heightMm: v })}
            />
          ) : null}
          {"depthMm" in feature ? (
            <Num
              label="Depth"
              value={feature.depthMm}
              onChange={(v) => onChange({ depthMm: v })}
            />
          ) : null}
          {feature.kind === "sketch" && feature.constraints?.length ? (
            <div className="selection-chip">
              Constraints:{" "}
              {feature.constraints
                .map((c) =>
                  c.kind === "dimension"
                    ? `${c.label ?? "dim"}=${c.valueMm}`
                    : c.kind,
                )
                .join(", ")}
            </div>
          ) : null}
        </>
      ) : null}
      {feature.kind === "hole" ? (
        <>
          <Num
            label="Dia"
            value={feature.diameterMm}
            onChange={(v) => onChange({ diameterMm: v })}
          />
          <Num
            label="Depth"
            value={feature.depthMm}
            onChange={(v) => onChange({ depthMm: v })}
          />
          <Num
            label="X"
            value={feature.xMm ?? 0}
            onChange={(v) => onChange({ xMm: v })}
          />
          <Num
            label="Y"
            value={feature.yMm ?? 0}
            onChange={(v) => onChange({ yMm: v })}
          />
        </>
      ) : null}
      {feature.kind === "fillet" ? (
        <Num
          label="Radius"
          value={feature.radiusMm}
          onChange={(v) => onChange({ radiusMm: v })}
        />
      ) : null}
      {feature.kind === "chamfer" ? (
        <Num
          label="Dist"
          value={feature.distanceMm}
          onChange={(v) => onChange({ distanceMm: v })}
        />
      ) : null}
      {feature.kind === "revolve" ? (
        <Num
          label="Angle°"
          value={feature.angleDeg ?? 360}
          onChange={(v) => onChange({ angleDeg: v })}
        />
      ) : null}
      {feature.kind === "mirror" ? (
        <label className="field">
          <span>Plane</span>
          <select
            value={feature.plane}
            onChange={(e) =>
              onChange({ plane: e.target.value as MirrorFeature["plane"] })
            }
          >
            <option value="front">Front</option>
            <option value="top">Top</option>
            <option value="right">Right</option>
          </select>
        </label>
      ) : null}
      {feature.kind === "linearPattern" ? (
        <>
          <Num
            label="Count"
            value={feature.count}
            onChange={(v) => onChange({ count: Math.max(1, Math.floor(v)) })}
          />
          <Num
            label="ΔX"
            value={feature.dxMm}
            onChange={(v) => onChange({ dxMm: v })}
          />
          <Num
            label="ΔY"
            value={feature.dyMm}
            onChange={(v) => onChange({ dyMm: v })}
          />
          <Num
            label="ΔZ"
            value={feature.dzMm}
            onChange={(v) => onChange({ dzMm: v })}
          />
        </>
      ) : null}
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={0.1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
