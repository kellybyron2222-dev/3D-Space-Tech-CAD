import { useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import {
  buildDrawingSvg,
  buildPrintHtml,
  formatHoleDia,
  suggestScale,
} from "../cad/drawingSheet";
import { meshBounds } from "../cad/meshBounds";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Associative drawing v0 — ortho boxes + overall dims from live mesh bbox. */
export function DrawingPanel({
  partName,
  mesh,
  parameters,
  holeDiaMm,
}: {
  partName: string;
  mesh: TessellationResult | null;
  parameters?: Record<string, number>;
  holeDiaMm?: number;
}) {
  const bounds = useMemo(() => meshBounds(mesh), [mesh]);

  const [sheetPartName, setSheetPartName] = useState(partName);
  const [sheetDate, setSheetDate] = useState(todayIso);
  const [sheetScale, setSheetScale] = useState("1:1");
  const [sheetMaterial, setSheetMaterial] = useState("Al 6061-T6 (L0)");
  const scaleUserEdited = useRef(false);

  useEffect(() => {
    setSheetPartName(partName);
  }, [partName]);

  useEffect(() => {
    scaleUserEdited.current = false;
    const b = meshBounds(mesh);
    if (!b) return;
    const maxDim = Math.max(b.size.x, b.size.y, b.size.z);
    setSheetScale(suggestScale(maxDim));
  }, [partName, mesh]);

  const holeDia = holeDiaMm ?? parameters?.holeDia;
  const holeNote =
    holeDia != null
      ? `⌀${formatHoleDia(holeDia)} THRU (from param)`
      : null;

  function sheetSvgOpts() {
    if (!bounds) return null;
    return {
      size: bounds.size,
      sheetPartName,
      sheetMaterial,
      sheetScale,
      sheetDate,
      holeNote,
    };
  }

  function exportSvg() {
    const opts = sheetSvgOpts();
    if (!opts) return;
    const svg = buildDrawingSvg(opts);
    saveAs(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${sheetPartName.replace(/\s+/g, "_")}_drawing.svg`,
    );
  }

  function printPdf() {
    const opts = sheetSvgOpts();
    if (!opts) return;
    const html = buildPrintHtml(sheetPartName, buildDrawingSvg(opts));
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      URL.revokeObjectURL(url);
      return;
    }
    win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
  }

  if (!bounds) {
    return (
      <div className="drawing-stub">
        <div className="drawing-sheet">
          <p className="hint">Rebuild a part to generate drawing views.</p>
        </div>
      </div>
    );
  }

  const { size } = bounds;
  const scale = 180 / Math.max(size.x, size.y, size.z, 1);

  function viewBox(
    w: number,
    h: number,
    label: string,
    dimW: number,
    dimH: number,
  ) {
    const pw = Math.max(8, w * scale);
    const ph = Math.max(8, h * scale);
    return (
      <div className="drawing-view">
        <span>{label}</span>
        <svg width="220" height="180" viewBox="0 0 220 180">
          <rect
            x={(220 - pw) / 2}
            y={(180 - ph) / 2}
            width={pw}
            height={ph}
            fill="none"
            stroke="#222"
            strokeWidth="1.5"
          />
          <line
            x1={(220 - pw) / 2}
            y1={(180 + ph) / 2 + 12}
            x2={(220 + pw) / 2}
            y2={(180 + ph) / 2 + 12}
            stroke="#444"
          />
          <text
            x={110}
            y={(180 + ph) / 2 + 26}
            textAnchor="middle"
            fontSize="11"
            fill="#333"
          >
            {dimW.toFixed(1)} mm
          </text>
          <line
            x1={(220 + pw) / 2 + 12}
            y1={(180 - ph) / 2}
            x2={(220 + pw) / 2 + 12}
            y2={(180 + ph) / 2}
            stroke="#444"
          />
          <text
            x={(220 + pw) / 2 + 18}
            y={90}
            fontSize="11"
            fill="#333"
            transform={`rotate(90 ${(220 + pw) / 2 + 18} 90)`}
          >
            {dimH.toFixed(1)} mm
          </text>
        </svg>
      </div>
    );
  }

  const titleFieldStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.15rem",
    minWidth: 0,
  };
  const inputStyle = {
    border: "1px solid #bbb",
    padding: "0.2rem 0.35rem",
    fontSize: "0.85rem",
    fontFamily: "inherit",
    background: "#fafafa",
  };

  return (
    <div className="drawing-stub">
      <div className="drawing-sheet">
        <div
          className="drawing-titleblock"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "0.75rem",
            alignItems: "end",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.5rem 1rem",
            }}
          >
            <label style={titleFieldStyle}>
              <span style={{ fontSize: "0.65rem", letterSpacing: "0.06em" }}>
                PART
              </span>
              <input
                type="text"
                value={sheetPartName}
                onChange={(e) => setSheetPartName(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={titleFieldStyle}>
              <span style={{ fontSize: "0.65rem", letterSpacing: "0.06em" }}>
                DATE
              </span>
              <input
                type="date"
                value={sheetDate}
                onChange={(e) => setSheetDate(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={titleFieldStyle}>
              <span style={{ fontSize: "0.65rem", letterSpacing: "0.06em" }}>
                SCALE
              </span>
              <input
                type="text"
                value={sheetScale}
                onChange={(e) => {
                  scaleUserEdited.current = true;
                  setSheetScale(e.target.value);
                }}
                style={inputStyle}
              />
            </label>
            <label style={titleFieldStyle}>
              <span style={{ fontSize: "0.65rem", letterSpacing: "0.06em" }}>
                MATERIAL
              </span>
              <input
                type="text"
                value={sheetMaterial}
                onChange={(e) => setSheetMaterial(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                display: "block",
                fontSize: "0.75rem",
                color: "#666",
                marginBottom: "0.35rem",
              }}
            >
              {size.x.toFixed(1)} × {size.y.toFixed(1)} × {size.z.toFixed(1)}{" "}
              mm · associative v0 (bbox)
            </span>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="secondary" onClick={printPdf}>
                Print / PDF
              </button>
              <button type="button" className="secondary" onClick={exportSvg}>
                Export SVG
              </button>
            </div>
          </div>
        </div>
        <div className="drawing-views">
          {viewBox(size.x, size.z, "FRONT (X–Z)", size.x, size.z)}
          {viewBox(size.x, size.y, "TOP (X–Y)", size.x, size.y)}
          {viewBox(size.y, size.z, "RIGHT (Y–Z)", size.y, size.z)}
          <div className="drawing-view">
            <span>NOTES</span>
            {holeNote && (
              <p style={{ fontWeight: 600, color: "#222" }}>{holeNote}</p>
            )}
            <p>
              Views derived from live Part Studio mesh bounds. True silhouette
              projection is next. Not ASME production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
