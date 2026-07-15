import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  createReference3UDocument,
  getParam,
  parseProjectFile,
  setPartMass,
  setPartParam,
  setPartWatts,
  toProjectFile,
  type SfdDocument,
  type SfdPart,
} from "@spacetech/sfd-lang";
import type { CdsCheckResult } from "@spacetech/rules-cds";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { getCadApi } from "./cad/client";
import { Viewport } from "./components/Viewport";
import {
  analyzeWorkbook,
  exportBomCsv,
  exportCdrMarkdown,
} from "./workbook";

type SourceMode = "parametric" | "imported";
type TabId = "design" | "budgets" | "scorecard" | "systems" | "export";

const REFERENCE_STEP_URL = "/reference/OSCubeSatStruct_Mk5_3U.step";
const REFERENCE_STEP_NAME = "OSCubeSatStruct Mk5 3U structure";
const STORAGE_KEY = "spacetech.reference3u.project";

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
  const workbook = useMemo(() => analyzeWorkbook(doc), [doc]);
  const [mesh, setMesh] = useState<TessellationResult | null>(null);
  const [status, setStatus] = useState("Loading OpenCascade worker…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SourceMode>("imported");
  const [importName, setImportName] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("design");
  const bootstrapped = useRef(false);

  const chassis = doc.parts.find((p) => p.id === "chassis");
  const mission = doc.parts.find((p) => p.id === "mission");
  const widthMm = chassis ? getParam(chassis, "widthMm", 100) : 100;
  const depthMm = chassis ? getParam(chassis, "depthMm", 100) : 100;
  const heightMm = chassis ? getParam(chassis, "heightMm", 340.5) : 340.5;
  const eclipseFraction = mission
    ? getParam(mission, "eclipseFraction", 0.35)
    : 0.35;

  const showMesh = useCallback(async (result: TessellationResult, label: string) => {
    const tris = result.faces.triangles.length / 3;
    if (!Number.isFinite(tris) || tris <= 0) {
      throw new Error("Kernel returned an empty mesh");
    }
    setMesh(result);
    setStatus(`${label} · ${Math.round(tris).toLocaleString()} triangles`);
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
      setStatus("Tessellating simple parametric frame…");
      try {
        const cad = getCadApi();
        await cad.ready();
        const result = await cad.createMesh(next);
        await showMesh(result, "Simple parametric frame");
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
      if (raw) setDoc(parseProjectFile(raw));
    } catch {
      /* ignore corrupt local draft */
    }
    void importFromUrl(REFERENCE_STEP_URL, REFERENCE_STEP_NAME);
  }, [importFromUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toProjectFile(doc)));
    } catch {
      /* quota / private mode */
    }
  }, [doc]);

  useEffect(() => {
    if (mode !== "parametric") return;
    void regenerateParametric(doc);
  }, [doc, mode, regenerateParametric]);

  async function downloadStep() {
    if (mode !== "parametric") {
      setError(
        "Export STEP from parametric mode, or re-download the open structure via Load open 3U structure.",
      );
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
    const blob = new Blob([JSON.stringify(toProjectFile(doc), null, 2)], {
      type: "application/json",
    });
    saveAs(blob, `${doc.name.replace(/\s+/g, "_")}.spacetech.json`);
  }

  async function loadProject(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      setDoc(parseProjectFile(text));
      setError(null);
      setTab("design");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid project file");
    } finally {
      if (projectRef.current) projectRef.current.value = "";
    }
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

  const { budgetSummary, scorecard, systems, scorecardLine } = workbook;
  const subsystems = groupParts(doc.parts);
  const editableBoards = doc.parts.filter(
    (p) => p.kind === "board" || p.subsystem === "payload",
  );

  return (
    <main>
      <header>
        <h1>Space Tech 3D</h1>
        <p>
          CubeSat Phase A workbook — open 3U structure visual + live mass/power
          budgets, CDS scorecard, VCRM/ICD stubs.
        </p>
      </header>

      <div className="banner" role="note">
        <strong>Not flight-qualified.</strong> Change solar panel height or
        subsystem watts and watch margins / scorecard update.{" "}
        {mode === "imported" ? (
          <>
            Viewing <code>{importName}</code>.
          </>
        ) : (
          <>
            Viewing parametric frame · <code>{doc.name}</code>.
          </>
        )}
        {error ? (
          <>
            <br />
            <span className="error-text">Error: {error}</span>
          </>
        ) : null}
      </div>

      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void importFromUrl(REFERENCE_STEP_URL, REFERENCE_STEP_NAME)}
        >
          Load open 3U structure
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
          Reset Reference-3U
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
          Save project
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => projectRef.current?.click()}
        >
          Open project
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
        <div className="grid">
          <section className="panel viewport-panel">
            <h2>3D viewport</h2>
            <Viewport mesh={mesh} status={status} />
            <p className="hint">
              Default geometry:{" "}
              <a
                href="https://github.com/elfenix7/OSCubeSatStruct"
                target="_blank"
                rel="noreferrer"
              >
                OSCubeSatStruct Mk5
              </a>{" "}
              (CERN-OHL-P). Budgets use the Reference-3U SFD beside it.
            </p>
          </section>

          <section className="panel">
            <h2>Envelope &amp; solar (live)</h2>
            <p className="hint">
              Envelope drives CDS. Panel height drives L0 PV generation.
            </p>
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
            <div className="stat">
              <span>Scorecard</span>
              <span>{scorecardLine}</span>
            </div>
          </section>

          <section className="panel">
            <h2>Subsystems</h2>
            {subsystems.map(([name, parts]) => (
              <div className="subsystem" key={name}>
                <div className="subsystem-title">{name}</div>
                <ul>
                  {parts.map((p) => (
                    <li key={p.id}>
                      <strong>{p.name}</strong>
                      {p.massKg != null ? ` · ${p.massKg.toFixed(2)} kg` : ""}
                      {p.wattsNominal != null
                        ? ` · ${p.wattsNominal.toFixed(1)} W nom`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
            <h2>Margins (traffic light)</h2>
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
              Edits update mass, CG, power modes, and soft power CDS live.
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
              <div className="check" key={check.id}>
                <div className={`status ${check.status}`}>{check.status}</div>
                <div>
                  <strong>{check.title}</strong> — {check.message}
                </div>
                <div className="citation">{check.citation}</div>
              </div>
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
                <div className="subsystem-title">
                  {row.id} · {row.status}
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
                  <ul className="assumptions">
                    {icd.openItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
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
              Download artifacts for advisor review. CDR is Markdown for MVP;
              PDF comes later.
            </p>
            <div className="actions">
              <button type="button" onClick={downloadBom}>
                Export BOM CSV
              </button>
              <button type="button" onClick={downloadCdr}>
                Export CDR Markdown
              </button>
              <button type="button" className="secondary" onClick={saveProject}>
                Save project JSON
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy || mode !== "parametric"}
                onClick={() => void downloadStep()}
              >
                Export parametric STEP
              </button>
            </div>
            <p className="hint">
              Tip: keep the open Mk5 structure for visuals; use{" "}
              <strong>Reset Reference-3U</strong> then export STEP when you need
              a parametric B-rep.
            </p>
          </section>
        </div>
      ) : null}

      <footer>
        University Phase A path: template → budgets → scorecard → VCRM/ICD →
        export. Apache-2.0 · see EXPORT_CONTROL.md
      </footer>
    </main>
  );
}
