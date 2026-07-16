import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  setParameter,
  applyParameters,
  createBracketDemo,
  createEmptyFeatureDocument,
  createCircleSketchEntity,
  createRectSketchEntity,
  createReference3UFeatures,
  ensureSketchEntities,
  filterValidSketchEntities,
  isValidSketchEntity,
  newFeatureId,
  newSketchEntityId,
  parseFeatureDocument,
  serializeFeatureDocument,
  solveSketch,
  syncSketchProfileFromEntities,
  type BoxFeature,
  type CadFeature,
  type ChamferFeature,
  type CutFeature,
  type ExtrudeFeature,
  type FeatureDocument,
  type FilletFeature,
  type HoleFeature,
  type ImportBodyFeature,
  type LinearPatternFeature,
  type MirrorFeature,
  type RevolveFeature,
  type SketchFeature,
} from "@spacetech/sfd-lang";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { getCadApi } from "./cad/client";
import { copyShareUrl, decodeShareHash } from "./cad/shareLink";
import {
  getMaterial,
  massKgFromVolume,
  MATERIALS,
  type MaterialId,
} from "./cad/massDisplay";
import type { MassPropsResult } from "./cad/types";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { AssemblyPanel } from "./components/AssemblyPanel";
import { DrawingPanel } from "./components/DrawingPanel";
import { ExitCoach } from "./components/ExitCoach";
import { GettingStarted } from "./components/GettingStarted";
import { SketchEditor } from "./components/SketchEditor";
import {
  Viewport,
  type SketchPlaceMode,
  type SketchPlacePayload,
} from "./components/Viewport";
import {
  clearAutosave,
  loadAutosavedDocument,
  useAutosave,
} from "./hooks/useAutosave";
import { usePartStudioHistory } from "./hooks/useHistory";
import {
  formatFeatureDimensionReadout,
  resolveViewportBodySelect,
} from "./cad/selectionMapping";

function isTypingTarget(t: EventTarget | null): boolean {
  if (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement
  ) {
    return true;
  }
  return t instanceof HTMLElement && t.isContentEditable;
}

function initialDocument(): FeatureDocument {
  const fromHash = decodeShareHash(window.location.hash);
  if (fromHash) return applyParameters(fromHash);
  const saved = loadAutosavedDocument();
  if (saved) return applyParameters(saved);
  return createBracketDemo();
}

type DocTab = "part" | "assembly" | "drawing" | "analysis";

type ActiveTool =
  | null
  | "cut"
  | "hole"
  | "fillet"
  | "chamfer"
  | "extrude"
  | "revolve"
  | "mirror"
  | "linearPattern"
  | "select";

const ACTIVE_TOOL_HINTS: Record<
  Exclude<ActiveTool, null | "select">,
  string
> = {
  cut: "Cut tool: click a face or press Enter to place cut from current sketch",
  hole: "Hole tool: click the solid or press Enter to place a hole",
  fillet:
    "Fillet tool: Shift+click an edge or click the solid, then press Enter",
  chamfer:
    "Chamfer tool: Shift+click an edge or click the solid, then press Enter",
  extrude:
    "Extrude tool: click the solid or press Enter to extrude from current sketch",
  revolve:
    "Revolve tool: click the solid or press Enter to place a revolve",
  mirror:
    "Mirror tool: click body or Enter to mirror across right plane",
  linearPattern:
    "Pattern tool: click body or Enter to add linear pattern",
};

function isEditableFeature(f: CadFeature | null): f is CadFeature {
  return f != null && f.kind !== "importBody";
}

export function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const initialDoc = initialDocument();
  const studio = usePartStudioHistory({
    doc: initialDoc,
    selectedFeatureId: initialDoc.features[0]?.id ?? null,
  });
  const doc = studio.doc;
  useAutosave(doc);
  const selectedFeatureId = studio.selectedFeatureId;
  const setSelectedFeatureId = studio.setSelectedFeatureId;
  const [bodySelected, setBodySelected] = useState(false);
  const [measureMm, setMeasureMm] = useState<number | null>(null);
  const [measureBox, setMeasureBox] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [faceIndex, setFaceIndex] = useState<number | null>(null);
  const [edgeIndex, setEdgeIndex] = useState<number | null>(null);
  const [edgeLengthMm, setEdgeLengthMm] = useState<number | null>(null);
  const [sketchPlaceMode, setSketchPlaceMode] =
    useState<SketchPlaceMode>(null);
  const [mesh, setMesh] = useState<TessellationResult | null>(null);
  const [mass, setMass] = useState<MassPropsResult | null>(null);
  const [materialId, setMaterialId] = useState<MaterialId>("al");
  const [importPreview, setImportPreview] = useState<TessellationResult | null>(
    null,
  );
  const [status, setStatus] = useState("Loading kernel…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DocTab>("part");
  const [fitNonce, setFitNonce] = useState(0);
  const [uxNote, setUxNote] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [draggingHandles, setDraggingHandles] = useState(false);
  const draggingHandlesRef = useRef(false);
  const rebuildGen = useRef(0);
  const displayMesh = importPreview ?? mesh;
  const displayMaterial = getMaterial(materialId);

  /** Drop import overlay so rebuilt feature mesh is visible again. */
  const dismissImportPreview = useCallback(() => {
    setImportPreview(null);
  }, []);

  const loadPartDocument = useCallback(
    (next: FeatureDocument, selectFirst = true) => {
      const resolved = applyParameters(next);
      studio.resetDoc(
        resolved,
        selectFirst ? (resolved.features[0]?.id ?? null) : null,
      );
      dismissImportPreview();
      setError(null);
      return resolved;
    },
    [studio.resetDoc, dismissImportPreview],
  );
  const displayMassKg = useMemo(() => {
    if (!mass) return null;
    return massKgFromVolume(mass.volumeMm3, displayMaterial.densityKgPerMm3);
  }, [mass, displayMaterial.densityKgPerMm3]);

  const selectedFeature = useMemo(
    () => doc.features.find((f) => f.id === selectedFeatureId) ?? null,
    [doc.features, selectedFeatureId],
  );

  const selectedFeatureDimensions = useMemo(
    () =>
      selectedFeature ? formatFeatureDimensionReadout(selectedFeature) : null,
    [selectedFeature],
  );

  useEffect(() => {
    if (selectedFeature?.kind !== "sketch") {
      setSketchPlaceMode(null);
    }
  }, [selectedFeature?.kind]);

  const sketchGhost = useMemo(() => {
    if (selectedFeature?.kind !== "sketch") return null;
    const sk = ensureSketchEntities(selectedFeature);
    return {
      plane: sk.plane,
      profile: sk.profile,
      widthMm: sk.widthMm,
      heightMm: sk.heightMm,
      offsetUMm: sk.offsetUMm,
      offsetVMm: sk.offsetVMm,
      entities: sk.entities,
    };
  }, [selectedFeature]);

  const rebuild = useCallback(async (next: FeatureDocument) => {
    const gen = ++rebuildGen.current;
    const editing = draggingHandlesRef.current;
    if (!editing) {
      setBusy(true);
      setStatus("Rebuilding…");
    } else {
      setStatus("Editing…");
    }
    setError(null);
    try {
      const cad = getCadApi();
      await cad.ready();
      const result = await cad.rebuildFeatures(next);
      if (gen !== rebuildGen.current) return;
      const tris = result.mesh.faces.triangles.length / 3;
      if (!Number.isFinite(tris) || tris <= 0) {
        throw new Error("Empty mesh from rebuild");
      }
      if (!next.features.some((f) => f.kind === "importBody")) {
        dismissImportPreview();
      }
      setMesh(result.mesh);
      setMass(result.mass);
      if (!editing) {
        setStatus(
          `${next.name} · ${Math.round(tris).toLocaleString()} tris · ${result.mass.massKg.toFixed(3)} kg (Al L0)`,
        );
        setFitNonce((n) => n + 1);
      }
    } catch (err) {
      if (gen !== rebuildGen.current) return;
      if (editing) return;
      const message = err instanceof Error ? err.message : "Rebuild failed";
      setError(message);
      setStatus("Rebuild failed");
      setMesh(null);
      clearAutosave();
      setUxNote(
        `Rebuild failed: ${message}. Try “Bracket demo” or “Reset & clear autosave”.`,
      );
    } finally {
      if (gen === rebuildGen.current && !editing) setBusy(false);
    }
  }, [dismissImportPreview]);

  function resetToBracketDemo() {
    clearAutosave();
    const next = loadPartDocument(createBracketDemo());
    setUxNote(
      `Loaded ${next.name} — edit Parameters (holeDia / wall) to see the solid change.`,
    );
  }

  useEffect(() => {
    draggingHandlesRef.current = draggingHandles;
  }, [draggingHandles]);

  useEffect(() => {
    // Skip kernel rebuild storms while dragging handles; rebuild once on release
    if (draggingHandles) return;
    void rebuild(doc);
  }, [doc, rebuild, draggingHandles]);

  function updateFeature(id: string, patch: Partial<CadFeature>) {
    dismissImportPreview();
    studio.setDoc((prev) => ({
      ...prev,
      features: prev.features.map((f) =>
        f.id === id ? ({ ...f, ...patch } as CadFeature) : f,
      ),
    }));
  }

  function setDocument(updater: (prev: FeatureDocument) => FeatureDocument) {
    dismissImportPreview();
    studio.setDoc(updater);
  }

  function addFeature(feature: CadFeature) {
    dismissImportPreview();
    studio.setDoc((prev) => ({
      ...prev,
      features: [...prev.features, feature],
    }));
    setSelectedFeatureId(feature.id);
    setUxNote(`Added ${feature.kind}: ${feature.name}`);
  }

  function addSketch() {
    const id = newFeatureId("sk");
    const rect = createRectSketchEntity(40, 30, 0, 0);
    const feature: SketchFeature = {
      id,
      name: `Sketch ${doc.features.filter((f) => f.kind === "sketch").length + 1}`,
      kind: "sketch",
      plane: "front",
      profile: "rect",
      widthMm: 40,
      heightMm: 30,
      entities: [rect],
      constraints: [
        { kind: "horizontal" },
        { kind: "vertical" },
        { kind: "dimension", valueMm: 40, label: "width" },
        { kind: "dimension", valueMm: 30, label: "height" },
      ],
    };
    addFeature(feature);
  }

  function sketchForNextOp(): SketchFeature | undefined {
    if (selectedFeature?.kind === "sketch") {
      return syncSketchProfileFromEntities(
        ensureSketchEntities(selectedFeature),
      );
    }
    const latest = [...doc.features]
      .reverse()
      .find((f): f is SketchFeature => f.kind === "sketch");
    return latest
      ? syncSketchProfileFromEntities(ensureSketchEntities(latest))
      : undefined;
  }

  function addExtrudeFromSketch() {
    const sketch = sketchForNextOp();
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
    const sketch = sketchForNextOp();
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
    let diameterMm = 6;
    let xMm = 15;
    let yMm = 10;
    if (selectedFeature?.kind === "sketch") {
      const sk = ensureSketchEntities(selectedFeature);
      const circle = sk.entities?.find((e) => e.kind === "circle");
      if (circle?.kind === "circle") {
        diameterMm = circle.diameterMm;
        xMm = circle.cx;
        yMm = circle.cy;
      } else if (sk.profile === "circle") {
        diameterMm = sk.widthMm;
        xMm = sk.offsetUMm ?? 0;
        yMm = sk.offsetVMm ?? 0;
      }
    }
    addFeature({
      id,
      name: `Hole ${doc.features.length + 1}`,
      kind: "hole",
      diameterMm,
      depthMm: 20,
      xMm,
      yMm,
      zMm: 0,
    } satisfies HoleFeature);
  }

  function addFillet(edgeOverride?: number) {
    const bound =
      edgeOverride != null
        ? [edgeOverride]
        : edgeIndex != null
          ? [edgeIndex]
          : undefined;
    const id = newFeatureId("fil");
    addFeature({
      id,
      name: `Fillet ${doc.features.length + 1}`,
      kind: "fillet",
      radiusMm: 2,
      edgeIndices: bound,
    } satisfies FilletFeature);
  }

  function addChamfer(edgeOverride?: number) {
    const bound =
      edgeOverride != null
        ? [edgeOverride]
        : edgeIndex != null
          ? [edgeIndex]
          : undefined;
    const id = newFeatureId("chm");
    addFeature({
      id,
      name: `Chamfer ${doc.features.length + 1}`,
      kind: "chamfer",
      distanceMm: 1.5,
      edgeIndices: bound,
    } satisfies ChamferFeature);
  }

  function toggleActiveTool(tool: Exclude<ActiveTool, null | "select">) {
    setActiveTool((prev) => {
      const next = prev === tool ? null : tool;
      if (next) setUxNote(ACTIVE_TOOL_HINTS[next]);
      return next;
    });
  }

  function applyActiveTool() {
    switch (activeTool) {
      case "cut":
        addCut();
        break;
      case "hole":
        addHole();
        break;
      case "fillet":
        addFillet();
        break;
      case "chamfer":
        addChamfer();
        break;
      case "extrude":
        addExtrudeFromSketch();
        break;
      case "revolve":
        addRevolve();
        break;
      case "mirror":
        addMirror();
        break;
      case "linearPattern":
        addLinearPattern();
        break;
      default:
        return;
    }
    setActiveTool(null);
  }

  const isPlacementTool =
    activeTool === "cut" ||
    activeTool === "hole" ||
    activeTool === "fillet" ||
    activeTool === "chamfer" ||
    activeTool === "extrude" ||
    activeTool === "revolve" ||
    activeTool === "mirror" ||
    activeTool === "linearPattern";

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
    studio.setDoc((prev) => {
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

  function duplicateSelected() {
    if (!selectedFeature) return;
    const prefixByKind: Partial<Record<CadFeature["kind"], string>> = {
      sketch: "sk",
      extrude: "ext",
      box: "box",
      cut: "cut",
      hole: "hole",
      fillet: "fil",
      chamfer: "chm",
      revolve: "rev",
      mirror: "mir",
      linearPattern: "pat",
    };
    const prefix = prefixByKind[selectedFeature.kind] ?? "feat";
    addFeature({
      ...selectedFeature,
      id: newFeatureId(prefix),
      name: `${selectedFeature.name} (copy)`,
    } as CadFeature);
  }

  function deleteSelected() {
    if (!selectedFeatureId) return;
    dismissImportPreview();
    studio.setDoc((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f.id !== selectedFeatureId),
    }));
    setSelectedFeatureId(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const inField = isTypingTarget(t);

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (inField) return;
        e.preventDefault();
        if (e.shiftKey) studio.redo();
        else studio.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        if (inField) return;
        e.preventDefault();
        studio.redo();
        return;
      }
      if (e.key === "Escape") {
        setActiveTool(null);
        setBodySelected(false);
        setMeasureMm(null);
        setMeasureBox(null);
        setFaceIndex(null);
        setEdgeIndex(null);
        setEdgeLengthMm(null);
        setSketchPlaceMode(null);
        return;
      }
      if (inField) return;

      if (tab !== "part") return;

      if (e.key === "Enter" && isPlacementTool) {
        e.preventDefault();
        applyActiveTool();
        return;
      }

      if (e.key === "End") {
        studio.setDoc((p) => ({ ...p, rollbackIndex: null }));
        return;
      }
      if (e.key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        addSketch();
      } else if (e.key === "e" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        addExtrudeFromSketch();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedFeatureId
      ) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio, tab, selectedFeatureId, doc, activeTool, isPlacementTool]);

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
    const url = copyShareUrl(doc);
    if (!url) {
      setUxNote("Part too large for URL share — use Save instead");
      return;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${new URL(url).hash}`,
    );
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
      loadPartDocument(next);
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
      const id = newFeatureId("imp");
      const feature: ImportBodyFeature = {
        id,
        name: file.name,
        kind: "importBody",
        sourceLabel: file.name,
      };
      studio.setDoc((prev) => ({
        ...prev,
        features: [...prev.features, feature],
      }));
      setSelectedFeatureId(id);
      setImportPreview(result);
      setFitNonce((n) => n + 1);
      setBodySelected(true);
      setStatus(`Imported ${file.name} (preview overlay)`);
      setUxNote(
        `Imported ${file.name} — preview overlay only until B-rep commit`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onViewportBodySelect(
    faceIndexNext: number | null,
    opts?: { altKey?: boolean; edgeSelect?: boolean },
  ) {
    const placingFeature = isPlacementTool;
    if (placingFeature) {
      applyActiveTool();
    }
    const bodyWasSelected = bodySelected;
    setBodySelected(true);
    if (faceIndexNext != null) setFaceIndex(faceIndexNext);

    if (!placingFeature) {
      const faceCount = displayMesh?.faces.faceGroups?.length ?? 0;
      const { featureId, uxNote } = resolveViewportBodySelect({
        features: doc.features,
        selectedFeatureId,
        bodyWasSelected,
        faceIndex: faceIndexNext,
        faceCount,
        altKey: Boolean(opts?.altKey),
        edgeSelect: Boolean(opts?.edgeSelect),
      });
      if (featureId) setSelectedFeatureId(featureId);
      if (uxNote) {
        setUxNote(
          uxNote.startsWith("Drag handles active:")
            ? uxNote
            : `${uxNote} Pick a toolbar tool (Cut, Hole, …) then click the solid to place.`,
        );
      }
    }

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
            disabled={!studio.canUndo}
            onClick={() => studio.undo()}
          >
            Undo
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!studio.canRedo}
            onClick={() => studio.redo()}
          >
            Redo
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              loadPartDocument(createEmptyFeatureDocument(), false);
            }}
          >
            New
          </button>
          <button
            type="button"
            className="secondary"
            onClick={resetToBracketDemo}
          >
            Bracket demo
          </button>
          {error ? (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                clearAutosave();
                resetToBracketDemo();
              }}
            >
              Reset & clear autosave
            </button>
          ) : null}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              loadPartDocument(createReference3UFeatures());
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
          <GettingStarted
            onTryEditHole={() => {
              const hole = doc.features.find((f) => f.kind === "hole");
              setSelectedFeatureId(hole?.id ?? doc.features[0]?.id ?? null);
              setUxNote(
                "Change holeDia under Parameters (right) — the hole in the 3D view should grow/shrink.",
              );
            }}
            onStartBlank={() => {
              clearAutosave();
              loadPartDocument(createEmptyFeatureDocument("My Part"), false);
              setUxNote("Blank Part Studio — click Sketch, then Extrude.");
            }}
          />
          <ExitCoach
            doc={doc}
            onGoAssembly={() => setTab("assembly")}
            onGoDrawing={() => setTab("drawing")}
            onDismiss={() =>
              setUxNote("Exit coach dismissed — use Assembly / Drawing tabs anytime")
            }
          />
          {error ? (
            <div className="ux-banner error-banner" role="alert">
              Rebuild failed: {error}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  clearAutosave();
                  resetToBracketDemo();
                }}
              >
                Reset to Bracket demo
              </button>
            </div>
          ) : null}
          <div className="cad-toolbar" role="toolbar">
            <button
              type="button"
              className={activeTool === "select" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() =>
                setActiveTool((prev) => (prev === "select" ? null : "select"))
              }
            >
              Select
            </button>
            <span className="toolbar-sep" />
            <button type="button" className="tool" disabled={busy} onClick={addSketch}>
              Sketch
            </button>
            <button
              type="button"
              className={activeTool === "extrude" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => toggleActiveTool("extrude")}
            >
              Extrude
            </button>
            <button type="button" className="tool" disabled={busy} onClick={addBox}>
              Box
            </button>
            <button
              type="button"
              className={activeTool === "cut" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => toggleActiveTool("cut")}
            >
              Cut
            </button>
            <button
              type="button"
              className={activeTool === "hole" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => toggleActiveTool("hole")}
            >
              Hole
            </button>
            <button
              type="button"
              className={activeTool === "revolve" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => toggleActiveTool("revolve")}
            >
              Revolve
            </button>
            <button
              type="button"
              className={activeTool === "fillet" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => toggleActiveTool("fillet")}
            >
              Fillet
            </button>
            <button
              type="button"
              className={activeTool === "chamfer" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => toggleActiveTool("chamfer")}
            >
              Chamfer
            </button>
            <button
              type="button"
              className={activeTool === "mirror" ? "tool active" : "tool"}
              disabled={busy}
              onClick={() => toggleActiveTool("mirror")}
            >
              Mirror
            </button>
            <button
              type="button"
              className={
                activeTool === "linearPattern" ? "tool active" : "tool"
              }
              disabled={busy}
              onClick={() => toggleActiveTool("linearPattern")}
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
              onClick={duplicateSelected}
            >
              Duplicate
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
              {draggingHandles ? "Editing…" : busy ? "Rebuilding…" : status}
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
                    studio.setDoc((p) => ({ ...p, rollbackIndex: null }))
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
                          studio.setDoc((p) => ({ ...p, rollbackIndex: index }))
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
                Click the solid to select Base/Hole/Extrude — click again to cycle
                features (Alt+click also cycles). Drag colored handles to edit.
                Pick Cut / Hole / Fillet / Chamfer in the toolbar, then click the
                solid (or Enter). Shift+click edges for fillet/chamfer. Double-click
                = rollback · Ctrl+Z undo · Esc clears tool.
              </p>
            </aside>

            <section className="cad-viewport-wrap">
              <Viewport
                mesh={displayMesh}
                status={status}
                fitNonce={fitNonce}
                onFit={() => setFitNonce((n) => n + 1)}
                selected={bodySelected}
                onSelectBody={onViewportBodySelect}
                toolHint={
                  activeTool && activeTool !== "select"
                    ? ACTIVE_TOOL_HINTS[activeTool]
                    : null
                }
                onClearSelection={() => {
                  setBodySelected(false);
                  setMeasureMm(null);
                  setMeasureBox(null);
                  setFaceIndex(null);
                  setEdgeIndex(null);
                  setEdgeLengthMm(null);
                }}
                editFeature={
                  selectedFeature?.kind === "box" ||
                  selectedFeature?.kind === "hole" ||
                  selectedFeature?.kind === "extrude" ||
                  selectedFeature?.kind === "revolve"
                    ? selectedFeature
                    : null
                }
                onFeatureDragStart={() => {
                  draggingHandlesRef.current = true;
                  setDraggingHandles(true);
                  // Snapshot before drag so Ctrl+Z restores pre-drag pose
                  studio.setDoc((prev) => structuredClone(prev));
                }}
                onFeatureDrag={(patch) => {
                  if (!selectedFeatureId) return;
                  studio.replaceDoc((prev) => {
                    const features = prev.features.map((f) =>
                      f.id === selectedFeatureId
                        ? ({ ...f, ...patch } as CadFeature)
                        : f,
                    );
                    let next: FeatureDocument = { ...prev, features };
                    const heightMm =
                      "heightMm" in patch ? patch.heightMm : undefined;
                    if (
                      heightMm != null &&
                      selectedFeatureId === "f-base" &&
                      prev.parameters?.wall != null
                    ) {
                      next = setParameter(next, "wall", heightMm);
                    }
                    return next;
                  });
                }}
                onFeatureDragEnd={() => {
                  draggingHandlesRef.current = false;
                  setDraggingHandles(false);
                }}
                sketchGhost={sketchGhost}
                sketchPlaceMode={
                  selectedFeature?.kind === "sketch" ? sketchPlaceMode : null
                }
                onSketchPlace={(payload: SketchPlacePayload) => {
                  if (selectedFeature?.kind !== "sketch" || !selectedFeatureId)
                    return;
                  const sk = ensureSketchEntities(selectedFeature);
                  const entities = [...(sk.entities ?? [])];
                  if (payload.kind === "circle") {
                    entities.push(
                      createCircleSketchEntity(20, payload.u, payload.v),
                    );
                  } else if (payload.kind === "rect") {
                    const u2 = payload.u2 ?? payload.u + 40;
                    const v2 = payload.v2 ?? payload.v + 30;
                    const x = Math.min(payload.u, u2);
                    const y = Math.min(payload.v, v2);
                    const widthMm = Math.abs(u2 - payload.u);
                    const heightMm = Math.abs(v2 - payload.v);
                    const rect = {
                      id: newSketchEntityId("se"),
                      kind: "rect" as const,
                      x,
                      y,
                      widthMm,
                      heightMm,
                    };
                    if (!isValidSketchEntity(rect)) return;
                    entities.push(rect);
                  } else {
                    entities.push({
                      id: newSketchEntityId("se"),
                      kind: "line",
                      x1: payload.u,
                      y1: payload.v,
                      x2: payload.u2 ?? payload.u + 30,
                      y2: payload.v2 ?? payload.v,
                    });
                  }
                  updateFeature(
                    selectedFeatureId,
                    solveSketch(
                      syncSketchProfileFromEntities({
                        ...sk,
                        entities: filterValidSketchEntities(entities),
                      }),
                    ),
                  );
                  setUxNote(`Placed ${payload.kind} on sketch plane`);
                }}
                faceIndex={faceIndex}
                edgeIndex={edgeIndex}
                onEdgeIndex={(i) => {
                  setEdgeIndex(i);
                  if (i == null || !mesh?.edges.lines) {
                    setEdgeLengthMm(null);
                    return;
                  }
                  const s = i * 6;
                  const L = mesh.edges.lines;
                  if (s + 5 >= L.length) {
                    setEdgeLengthMm(null);
                    return;
                  }
                  const dx = L[s]! - L[s + 3]!;
                  const dy = L[s + 1]! - L[s + 4]!;
                  const dz = L[s + 2]! - L[s + 5]!;
                  setEdgeLengthMm(Math.sqrt(dx * dx + dy * dy + dz * dz));
                  if (activeTool === "fillet") {
                    addFillet(i);
                    setActiveTool(null);
                  } else if (activeTool === "chamfer") {
                    addChamfer(i);
                    setActiveTool(null);
                  }
                }}
              />
            </section>

            <aside className="props-panel">
              <h2>Properties</h2>
              {faceIndex != null ? (
                <div className="selection-chip">Face group #{faceIndex}</div>
              ) : null}
              {selectedFeatureDimensions ? (
                <div className="selection-chip">{selectedFeatureDimensions}</div>
              ) : null}
              {edgeIndex != null ? (
                <div className="selection-chip">
                  Edge #{edgeIndex}
                  {edgeLengthMm != null
                    ? ` · ${edgeLengthMm.toFixed(2)} mm`
                    : ""}
                  {selectedFeature?.kind === "fillet" ||
                  selectedFeature?.kind === "chamfer" ? (
                    <button
                      type="button"
                      className="linkish"
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        if (edgeIndex == null || !selectedFeatureId) return;
                        const prev =
                          (selectedFeature as FilletFeature | ChamferFeature)
                            .edgeIndices ?? [];
                        const next = prev.includes(edgeIndex)
                          ? prev
                          : [...prev, edgeIndex];
                        updateFeature(selectedFeatureId, {
                          edgeIndices: next,
                        });
                        setUxNote(
                          `Bound edge #${edgeIndex} to ${selectedFeature.kind} (kernel uses global fillet if edge filter unsupported)`,
                        );
                      }}
                    >
                      Bind to feature
                    </button>
                  ) : null}
                </div>
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
                        value={val as number}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          setDocument((prev) => setParameter(prev, key, n));
                        }}
                      />
                    </label>
                  ))
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const name = window.prompt("Parameter name?");
                    if (!name?.trim()) return;
                    setDocument((prev) => setParameter(prev, name.trim(), 10));
                  }}
                >
                  Add param
                </button>
              </div>
              {mass && displayMassKg != null ? (
                <div className="mass-block">
                  <div className="stat">
                    <span>Mass</span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem",
                      }}
                    >
                      <span>
                        {displayMassKg.toFixed(4)} kg ·{" "}
                        <select
                          value={materialId}
                          aria-label="Material density"
                          onChange={(e) =>
                            setMaterialId(e.target.value as MaterialId)
                          }
                          style={{ width: "auto", font: "inherit" }}
                        >
                          {MATERIALS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </span>
                    </span>
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
                  sketchPlaceMode={sketchPlaceMode}
                  onSketchPlaceMode={setSketchPlaceMode}
                />
              )}
            </aside>
          </div>
        </>
      ) : null}

      {tab === "assembly" ? <AssemblyPanel partDoc={doc} /> : null}
      {tab === "drawing" ? (
        <DrawingPanel
          partName={doc.name}
          mesh={displayMesh}
          parameters={doc.parameters}
          holeDiaMm={doc.parameters?.holeDia}
        />
      ) : null}
      {tab === "analysis" ? <AnalysisPanel /> : null}
    </div>
  );
}

function FeatureProps({
  feature,
  onChange,
  sketchPlaceMode = null,
  onSketchPlaceMode,
}: {
  feature: CadFeature;
  onChange: (patch: Partial<CadFeature>) => void;
  sketchPlaceMode?: SketchPlaceMode;
  onSketchPlaceMode?: (mode: SketchPlaceMode) => void;
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
          {feature.kind === "sketch" ? (
            <>
              <div className="sketch-place-tools">
                <span className="hint">Place on plane:</span>
                {(
                  [
                    ["rect", "Rect"],
                    ["circle", "Circle"],
                    ["line", "Line"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={
                      sketchPlaceMode === mode ? "tool active" : "tool"
                    }
                    onClick={() =>
                      onSketchPlaceMode?.(
                        sketchPlaceMode === mode ? null : mode,
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <SketchEditor
                sketch={feature}
                onChange={(patch) => {
                  const merged = { ...feature, ...patch } as SketchFeature;
                  onChange(
                    solveSketch(
                      syncSketchProfileFromEntities(
                        ensureSketchEntities(merged),
                      ),
                    ),
                  );
                }}
              />
            </>
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
        <>
          <Num
            label="Radius"
            value={feature.radiusMm}
            onChange={(v) => onChange({ radiusMm: v })}
          />
          {feature.edgeIndices?.length ? (
            <div className="selection-chip">
              Edges: {feature.edgeIndices.join(", ")}
            </div>
          ) : (
            <p className="hint">Shift+click an edge, then Bind or add Fillet.</p>
          )}
        </>
      ) : null}
      {feature.kind === "chamfer" ? (
        <>
          <Num
            label="Dist"
            value={feature.distanceMm}
            onChange={(v) => onChange({ distanceMm: v })}
          />
          {feature.edgeIndices?.length ? (
            <div className="selection-chip">
              Edges: {feature.edgeIndices.join(", ")}
            </div>
          ) : null}
        </>
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
          <p className="hint">Max 24 copies</p>
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
