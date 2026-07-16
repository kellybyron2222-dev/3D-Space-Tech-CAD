import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  createReference3UDocument,
  getParam,
  setPartMass,
  setPartParam,
  setPartWatts,
  type SfdDocument,
  type SfdPart,
} from "@spacetech/sfd-lang";
import type { CdsCheckResult } from "@spacetech/rules-cds";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import {
  createReference3USystemsPack,
  type EvidenceStatus,
  type SystemsPack,
} from "@spacetech/systems";
import { getCadApi } from "./cad/client";
import { Viewport } from "./components/Viewport";
import { parseAppProjectFile, toAppProjectFile } from "./projectIO";
import {
  buildNextSteps,
  primaryPowerMargin,
  suggestPanelHeightMm,
  tabForCheck,
  worstCdsStatus,
  type TabId,
} from "./ux";
import {
  analyzeWorkbook,
  exportBomCsv,
  exportCdrHtml,
  exportCdrMarkdown,
} from "./workbook";

type SourceMode = "parametric" | "imported";

const REFERENCE_STEP_URL = "/reference/OSCubeSatStruct_Mk5_3U.step";
const REFERENCE_STEP_NAME = "OSCubeSatStruct Mk5 3U structure";
const STORAGE_KEY = "spacetech.reference3u.project.v2";

const TABS: { id: TabId; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "budgets", label: "Budgets" },
  { id: "scorecard", label: "Scorecard" },
  { id: "systems", label: "Systems" },
  { id: "export", label: "Export" },
];

function groupParts(parts: SfdPart[]) {
  const groups = new Map<string, SfdPart[]>();
  for (const part of parts) {
    if (part.id === "mission") continue;
    const key = part.subsystem ?? "other";
    const list = groups.get(key) ?? [];
    list.push(part);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function setBothPanelHeights(doc: SfdDocument, heightMm: number): SfdDocument {
  let next = setPartParam(doc, "solar-xp", "heightMm", heightMm);
  next = setPartParam(next, "solar-xn", "heightMm", heightMm);
  return next;
}

export function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<SfdDocument>(() => createReference3UDocument());
  const [systems, setSystems] = useState<SystemsPack>(() =>
    createReference3USystemsPack(),
  );
  const workbook = useMemo(() => analyzeWorkbook(doc, systems), [doc, systems]);
  const [mesh, setMesh] = useState<TessellationResult | null>(null);
  const [status, setStatus] = useState("Loading OpenCascade worker…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SourceMode>("imported");
  const [importName, setImportName] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("design");
  const [fitNonce, setFitNonce] = useState(0);
  const [guideOpen, setGuideOpen] = useState(true);
  const bootstrapped = useRef(false);

  const chassis = doc.parts.find((p) => p.id === "chassis");
  const mission = doc.parts.find((p) => p.id === "mission");
  const widthMm = chassis ? getParam(chassis, "widthMm", 100) : 100;
  const depthMm = chassis ? getParam(chassis, "depthMm", 100) : 100;
  const heightMm = chassis ? getParam(chassis, "heightMm", 340.5) : 340.5;
  const eclipseFraction = mission
    ? getParam(mission, "eclipseFraction", 0.35)
    : 0.35;

  const nextSteps = useMemo(
    () =>
      buildNextSteps({
        scorecard: workbook.scorecard,
        budgetSummary: workbook.budgetSummary,
        systems,
        mode,
      }),
    [workbook.scorecard, workbook.budgetSummary, systems, mode],
  );
  const powerMargin = primaryPowerMargin(workbook.budgetSummary);
  const cdsWorst = worstCdsStatus(workbook.scorecard);
  const suggestedPanelH = useMemo(
    () =>
      suggestPanelHeightMm(doc, workbook.budgetSummary.powerByMode.nominal),
    [doc, workbook.budgetSummary.powerByMode.nominal],
  );

  const showMesh = useCallback(async (result: TessellationResult, label: string) => {
    const tris = result.faces.triangles.length / 3;
    if (!Number.isFinite(tris) || tris <= 0) {
      throw new Error("Kernel returned an empty mesh");
    }
    setMesh(result);
    setStatus(`${label} · ${Math.round(tris).toLocaleString()} triangles`);
    setFitNonce((n) => n + 1);
  }, []);

  const importFromUrl = useCallback(
    async (url: string, label: string) => {
      setBusy(true);
      setError(null);
      setStatus(`Loading ${label}…`);
      try {
        const cad = getCadApi();
        await cad.ready();
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not fetch ${url} (${res.status})`);
        const blob = await res.blob();
        const file = new File(
          [blob],
          label.endsWith(".step") ? label : `${label}.step`,
          { type: "application/step" },
        );
        const result = await cad.importModel(file);
        await showMesh(result, label);
        setMode("imported");
        setImportName(label);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        setError(message);
        setStatus("Import failed");
        setMesh(null);
      } finally {
        setBusy(false);
      }
    },
    [showMesh],
  );

  const regenerateParametric = useCallback(
    async (next: SfdDocument) => {
      setBusy(true);
      setError(null);
      setStatus("Tessellating parametric frame…");
      try {
        const cad = getCadApi();
        await cad.ready();
        const result = await cad.createMesh(next);
        await showMesh(result, "Parametric frame");
        setMode("parametric");
        setImportName(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kernel error";
        setError(message);
        setStatus("Kernel failed — see banner");
        setMesh(null);
      } finally {
        setBusy(false);
      }
    },
    [showMesh],
  );

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const loaded = parseAppProjectFile(raw);
        setDoc(loaded.document);
        setSystems(loaded.systems);
      }
    } catch {
      /* ignore corrupt local draft */
    }
    void importFromUrl(REFERENCE_STEP_URL, REFERENCE_STEP_NAME);
  }, [importFromUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(toAppProjectFile(doc, systems)),
      );
    } catch {
      /* quota / private mode */
    }
  }, [doc, systems]);

  useEffect(() => {
    if (mode !== "parametric") return;
    void regenerateParametric(doc);
  }, [doc, mode, regenerateParametric]);

  async function downloadStep() {
    if (mode !== "parametric") {
      setError("Switch to Show parametric frame first, then export STEP.");
      setTab("export");
      return;
    }
    setBusy(true);
    try {
      const blob = await getCadApi().createStep(doc);
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
    setStatus(`Importing ${file.name}…`);
    try {
      const cad = getCadApi();
      await cad.ready();
      const result = await cad.importModel(file);
      await showMesh(result, file.name);
      setMode("imported");
      setImportName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStatus("Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function saveProject() {
    const blob = new Blob(
      [JSON.stringify(toAppProjectFile(doc, systems), null, 2)],
      { type: "application/json" },
    );
    saveAs(blob, `${doc.name.replace(/\s+/g, "_")}.spacetech.json`);
  }

  async function loadProject(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const loaded = parseAppProjectFile(text);
      setDoc(loaded.document);
      setSystems(loaded.systems);
      setError(null);
      setTab("design");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid project file");
    } finally {
      if (projectRef.current) projectRef.current.value = "";
    }
  }

  function resetWorkbookKeepVisual() {
    setDoc(createReference3UDocument());
    setSystems(createReference3USystemsPack());
    setError(null);
    if (mode !== "imported") {
      void importFromUrl(REFERENCE_STEP_URL, REFERENCE_STEP_NAME);
    }
  }

  function setVcrmStatus(id: string, statusValue: EvidenceStatus) {
    setSystems((prev) => ({
      ...prev,
      vcrm: prev.vcrm.map((row) =>
        row.id === id ? { ...row, status: statusValue } : row,
      ),
    }));
  }

  function toggleIcdItem(icdId: string, item: string) {
    setSystems((prev) => ({
      ...prev,
      icds: prev.icds.map((icd) => {
        if (icd.id !== icdId) return icd;
        const resolved = new Set(icd.resolvedOpenItems ?? []);
        if (resolved.has(item)) resolved.delete(item);
        else resolved.add(item);
        return { ...icd, resolvedOpenItems: [...resolved] };
      }),
    }));
  }

  function applySuggestedPanelHeight() {
    if (suggestedPanelH == null) return;
    setDoc(setBothPanelHeights(doc, suggestedPanelH));
    setTab("design");
  }

  function downloadBom() {
    const csv = exportBomCsv(doc);
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `${doc.name.replace(/\s+/g, "_")}_BOM.csv`,
    );
  }

  function downloadCdr() {
    const md = exportCdrMarkdown(doc, workbook);
    saveAs(
      new Blob([md], { type: "text/markdown;charset=utf-8" }),
      `${doc.name.replace(/\s+/g, "_")}_CDR.md`,
    );
  }

  function downloadCdrHtml() {
    const html = exportCdrHtml(doc, workbook);
    saveAs(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      `${doc.name.replace(/\s+/g, "_")}_CDR.html`,
    );
  }

  const { budgetSummary, scorecard, scorecardLine } = workbook;
  const subsystems = groupParts(doc.parts);
  const editableBoards = doc.parts.filter(
    (p) => p.kind === "board" || p.subsystem === "payload",
  );

  return (
    <main>
      <header className="app-header">
        <div>
          <h1>Space Tech 3D</h1>
          <p>CubeSat Phase A workbook for university teams.</p>
        </div>
        <p className="disclaimer-pill">Not flight-qualified · L0</p>
      </header>

      <div className={`status-strip status-${cdsWorst}`} role="status">
        <button type="button" className="strip-chip" onClick={() => setTab("budgets")}>
          <span>Mass</span>
          <strong>{budgetSummary.totalMassKg.toFixed(2)} kg</strong>
        </button>
        <button type="button" className="strip-chip" onClick={() => setTab("design")}>
          <span>PV (L0)</span>
          <strong>{budgetSummary.solarGenerationW.toFixed(1)} W</strong>
        </button>
        <button
          type="button"
          className={`strip-chip margin-${powerMargin?.status ?? "info"}`}
          onClick={() => setTab("budgets")}
        >
          <span>Power margin</span>
          <strong>{powerMargin?.value ?? "—"}</strong>
        </button>
        <button
          type="button"
          className={`strip-chip status-${cdsWorst}`}
          onClick={() => setTab("scorecard")}
        >
          <span>CDS</span>
          <strong>{scorecardLine}</strong>
        </button>
      </div>

      {error ? (
        <div className="banner error-banner" role="alert">
          <span className="error-text">{error}</span>
        </div>
      ) : null}

      <div className="coach">
        <button
          type="button"
          className="coach-toggle"
          onClick={() => setGuideOpen((v) => !v)}
        >
          {guideOpen ? "Hide" : "Show"} guided path
        </button>
        {guideOpen ? (
          <ol className="coach-list">
            {nextSteps.map((step, i) => (
              <li key={step.id}>
                <div className="coach-card">
                  <button
                    type="button"
                    className="coach-step"
                    onClick={() => setTab(step.tab)}
                  >
                    <span className="coach-num">{i + 1}</span>
                    <span>
                      <strong>{step.title}</strong>
                      <span className="citation">{step.detail}</span>
                    </span>
                  </button>
                  {step.id === "power-margin" && suggestedPanelH != null ? (
                    <button
                      type="button"
                      className="coach-apply"
                      onClick={applySuggestedPanelHeight}
                    >
                      Apply panel H {suggestedPanelH} mm
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void importFromUrl(REFERENCE_STEP_URL, REFERENCE_STEP_NAME)}
        >
          Load open 3U
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={resetWorkbookKeepVisual}
        >
          Reset numbers
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            setMode("parametric");
            setDoc(createReference3UDocument());
          }}
        >
          Show parametric frame
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Import STEP / STL
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
        <input
          ref={fileRef}
          type="file"
          accept=".step,.stp,.stl,model/step,model/stl"
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

      <nav className="tabs" aria-label="Workbook sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "design" ? (
        <div className="grid design-grid">
          <section className="panel viewport-panel">
            <div className="panel-head">
              <h2>3D viewport</h2>
              <span className="badge">
                {mode === "imported" ? "Open structure" : "Parametric"}
              </span>
            </div>
            <Viewport
              mesh={mesh}
              status={status}
              fitNonce={fitNonce}
              onFit={() => setFitNonce((n) => n + 1)}
              envelopeMm={workbook.envelope}
              showEnvelope
            />
            <p className="hint">
              Dark wire box = CDS envelope from the numbers below. Imported Mk5
              mesh stays fixed; change envelope to see the ghost resize.
            </p>
          </section>

          <section className="panel">
            <h2>Envelope &amp; solar (live)</h2>
            <label className="field">
              <span>Width</span>
              <input
                type="number"
                min={80}
                max={120}
                step={0.5}
                value={widthMm}
                disabled={busy}
                onChange={(e) =>
                  setDoc(setPartParam(doc, "chassis", "widthMm", Number(e.target.value)))
                }
              />
            </label>
            <label className="field">
              <span>Depth</span>
              <input
                type="number"
                min={80}
                max={120}
                step={0.5}
                value={depthMm}
                disabled={busy}
                onChange={(e) =>
                  setDoc(setPartParam(doc, "chassis", "depthMm", Number(e.target.value)))
                }
              />
            </label>
            <label className="field">
              <span>Height</span>
              <input
                type="number"
                min={100}
                max={400}
                step={0.5}
                value={heightMm}
                disabled={busy}
                onChange={(e) =>
                  setDoc(setPartParam(doc, "chassis", "heightMm", Number(e.target.value)))
                }
              />
            </label>
            <label className="field">
              <span>Panel H</span>
              <input
                type="number"
                min={80}
                max={320}
                step={1}
                value={workbook.panelHeightMm}
                disabled={busy}
                onChange={(e) =>
                  setDoc(setBothPanelHeights(doc, Number(e.target.value)))
                }
              />
            </label>
            <label className="field">
              <span>Eclipse</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={eclipseFraction}
                disabled={busy}
                onChange={(e) =>
                  setDoc(
                    setPartParam(
                      doc,
                      "mission",
                      "eclipseFraction",
                      Number(e.target.value),
                    ),
                  )
                }
              />
            </label>
            <div className="stat">
              <span>PV area</span>
              <span>{workbook.solarAreaM2.toFixed(4)} m²</span>
            </div>
            <div className="stat">
              <span>PV gen (L0)</span>
              <span>{budgetSummary.solarGenerationW.toFixed(2)} W</span>
            </div>
            <button
              type="button"
              className="secondary inline-action"
              onClick={() => setTab("budgets")}
            >
              Edit board loads →
            </button>
          </section>

          <section className="panel span-2">
            <h2>Subsystems at a glance</h2>
            <div className="subsystem-row">
              {subsystems.map(([name, parts]) => (
                <div className="subsystem" key={name}>
                  <div className="subsystem-title">{name}</div>
                  <ul>
                    {parts.map((p) => (
                      <li key={p.id}>
                        <strong>{p.name}</strong>
                        {p.massKg != null ? ` · ${p.massKg.toFixed(2)} kg` : ""}
                        {p.wattsNominal != null
                          ? ` · ${p.wattsNominal.toFixed(1)} W`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "budgets" ? (
        <div className="grid">
          <section className="panel">
            <h2>Mass &amp; power modes</h2>
            <div className="stat">
              <span>Total mass</span>
              <span>{budgetSummary.totalMassKg.toFixed(3)} kg</span>
            </div>
            {budgetSummary.cgMm ? (
              <div className="stat">
                <span>CG (mm)</span>
                <span>
                  {budgetSummary.cgMm.x.toFixed(1)},{" "}
                  {budgetSummary.cgMm.y.toFixed(1)},{" "}
                  {budgetSummary.cgMm.z.toFixed(1)}
                </span>
              </div>
            ) : null}
            <div className="stat">
              <span>Safe</span>
              <span>{budgetSummary.powerByMode.safe.toFixed(2)} W</span>
            </div>
            <div className="stat">
              <span>Nominal</span>
              <span>{budgetSummary.powerByMode.nominal.toFixed(2)} W</span>
            </div>
            <div className="stat">
              <span>Peak</span>
              <span>{budgetSummary.powerByMode.peak.toFixed(2)} W</span>
            </div>
            <div className="stat">
              <span>Eclipse</span>
              <span>{budgetSummary.powerByMode.eclipse.toFixed(2)} W</span>
            </div>
            <div className="stat">
              <span>PV generation</span>
              <span>{budgetSummary.solarGenerationW.toFixed(2)} W</span>
            </div>
          </section>

          <section className="panel">
            <h2>Margins</h2>
            {budgetSummary.margins.map((m) => (
              <div className="check" key={m.id}>
                <div className={`status margin-${m.status}`}>{m.status}</div>
                <div>
                  <strong>{m.title}</strong> — {m.value}
                </div>
                <div className="citation">{m.message}</div>
              </div>
            ))}
          </section>

          <section className="panel span-2">
            <h2>Edit board loads (kg / W nominal)</h2>
            <p className="hint">
              Raise Panel H on Design if power margin stays red after cutting load.
            </p>
            <div className="edit-table">
              {editableBoards.map((p) => (
                <div className="edit-row" key={p.id}>
                  <span className="edit-name">{p.name}</span>
                  <label>
                    kg
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={p.massKg ?? 0}
                      onChange={(e) =>
                        setDoc(setPartMass(doc, p.id, Number(e.target.value)))
                      }
                    />
                  </label>
                  <label>
                    W nom
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={p.wattsNominal ?? 0}
                      onChange={(e) =>
                        setDoc(
                          setPartWatts(doc, p.id, {
                            wattsNominal: Number(e.target.value),
                          }),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "scorecard" ? (
        <div className="grid">
          <section className="panel span-2">
            <h2>CDS + soft constraints · {scorecardLine}</h2>
            {scorecard.map((check: CdsCheckResult) => (
              <button
                type="button"
                className="check check-button"
                key={check.id}
                onClick={() => setTab(tabForCheck(check.id))}
              >
                <div className={`status ${check.status}`}>{check.status}</div>
                <div>
                  <strong>{check.title}</strong> — {check.message}
                  <div className="citation">{check.citation}</div>
                </div>
              </button>
            ))}
            <h2 style={{ marginTop: "1rem" }}>Analysis assumptions</h2>
            <ul className="assumptions">
              {budgetSummary.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {tab === "systems" ? (
        <div className="grid">
          <section className="panel">
            <h2>Assumption registry</h2>
            <ul className="assumptions">
              {systems.assumptions.map((a) => (
                <li key={a.id}>
                  <span className="badge">{a.fidelity}</span> {a.text}
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>VCRM-lite</h2>
            {systems.vcrm.map((row) => (
              <div className="vcrm" key={row.id}>
                <div className="vcrm-head">
                  <div className="subsystem-title">{row.id}</div>
                  <label className="vcrm-status">
                    Status
                    <select
                      value={row.status}
                      onChange={(e) =>
                        setVcrmStatus(row.id, e.target.value as EvidenceStatus)
                      }
                    >
                      <option value="planned">planned</option>
                      <option value="in_progress">in progress</option>
                      <option value="complete">complete</option>
                      <option value="waived">waived</option>
                    </select>
                  </label>
                </div>
                <strong>{row.requirement}</strong>
                <div className="citation">
                  Method: {row.method}
                  <br />
                  Evidence: {row.evidence}
                </div>
              </div>
            ))}
          </section>
          <section className="panel span-2">
            <h2>ICD stubs</h2>
            <div className="icd-grid">
              {systems.icds.map((icd) => (
                <div className="icd" key={icd.id}>
                  <div className="subsystem-title">
                    {icd.domain} · {icd.id}
                  </div>
                  <strong>{icd.title}</strong>
                  <p className="hint">Interface to: {icd.interfaceTo}</p>
                  <p>{icd.notes}</p>
                  <ul className="icd-checks">
                    {icd.openItems.map((item) => {
                      const done = (icd.resolvedOpenItems ?? []).includes(item);
                      return (
                        <li key={item}>
                          <label className={done ? "done" : undefined}>
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => toggleIcdItem(icd.id, item)}
                            />
                            {item}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "export" ? (
        <div className="grid">
          <section className="panel span-2">
            <h2>Phase A package</h2>
            <p className="hint">
              Download for advisor review. Visual stays on Mk5 unless you switch
              to parametric for STEP.
            </p>
            <div className="actions">
              <button type="button" onClick={downloadBom}>
                Export BOM CSV
              </button>
              <button type="button" onClick={downloadCdr}>
                Export CDR Markdown
              </button>
              <button type="button" onClick={downloadCdrHtml}>
                Export CDR HTML (print/PDF)
              </button>
              <button type="button" className="secondary" onClick={saveProject}>
                Save project JSON
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void downloadStep()}
              >
                Export parametric STEP
              </button>
            </div>
            {mode === "imported" ? (
              <p className="hint">
                Parametric STEP needs{" "}
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setMode("parametric")}
                >
                  Show parametric frame
                </button>{" "}
                first.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      <footer>
        Viewing{" "}
        {mode === "imported" ? (
          <code>{importName}</code>
        ) : (
          <>
            parametric · <code>{doc.name}</code>
          </>
        )}
        . Apache-2.0 · EXPORT_CONTROL.md
      </footer>
    </main>
  );
}
