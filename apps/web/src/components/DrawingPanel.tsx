import { useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { meshBounds } from "../cad/meshBounds";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatHoleDia(dia: number): string {
  return Number.isInteger(dia) ? String(dia) : dia.toFixed(1);
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

  useEffect(() => {
    setSheetPartName(partName);
  }, [partName]);

  const holeDia = holeDiaMm ?? parameters?.holeDia;
  const holeNote =
    holeDia != null
      ? `⌀${formatHoleDia(holeDia)} THRU (from param)`
      : null;

  function exportSvg() {
    if (!bounds) return;
    const { size } = bounds;
    const viewScale = 2.2;
    const holeNoteSvg = holeNote
      ? `<text x="640" y="520" font-family="sans-serif" font-size="12" fill="#222">${escapeXml(holeNote)}</text>`
      : "";
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640">
  <rect width="100%" height="100%" fill="#f7f5f0"/>
  <text x="28" y="36" font-family="Georgia, serif" font-size="22" fill="#1a1a1a">${escapeXml(sheetPartName)}</text>
  <text x="28" y="58" font-family="sans-serif" font-size="12" fill="#555">Associative drawing v0 · Overall ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm</text>
  <g transform="translate(40,90)">
    <text font-family="sans-serif" font-size="11" fill="#333">FRONT (X–Z)</text>
    <rect x="0" y="16" width="${size.x * viewScale}" height="${size.z * viewScale}" fill="none" stroke="#222" stroke-width="1.5"/>
    <text x="${(size.x * viewScale) / 2}" y="${size.z * viewScale + 34}" text-anchor="middle" font-size="11">${size.x.toFixed(1)}</text>
  </g>
  <g transform="translate(320,90)">
    <text font-family="sans-serif" font-size="11" fill="#333">TOP (X–Y)</text>
    <rect x="0" y="16" width="${size.x * viewScale}" height="${size.y * viewScale}" fill="none" stroke="#222" stroke-width="1.5"/>
    <text x="${(size.x * viewScale) / 2}" y="${size.y * viewScale + 34}" text-anchor="middle" font-size="11">${size.x.toFixed(1)}</text>
  </g>
  <g transform="translate(600,90)">
    <text font-family="sans-serif" font-size="11" fill="#333">RIGHT (Y–Z)</text>
    <rect x="0" y="16" width="${size.y * viewScale}" height="${size.z * viewScale}" fill="none" stroke="#222" stroke-width="1.5"/>
    <text x="${(size.y * viewScale) / 2}" y="${size.z * viewScale + 34}" text-anchor="middle" font-size="11">${size.y.toFixed(1)}</text>
  </g>
  <g transform="translate(640,440)">
    <text font-family="sans-serif" font-size="10" fill="#666">NOTES</text>
    ${holeNoteSvg}
    <text x="0" y="${holeNote ? 36 : 18}" font-family="sans-serif" font-size="10" fill="#666">Views are bbox envelopes, not true silhouette.</text>
  </g>
  <g transform="translate(28,540)">
    <rect x="0" y="0" width="844" height="72" fill="none" stroke="#333" stroke-width="1"/>
    <text x="12" y="22" font-family="sans-serif" font-size="11" fill="#222">PART: ${escapeXml(sheetPartName)}</text>
    <text x="12" y="40" font-family="sans-serif" font-size="11" fill="#222">MATERIAL: ${escapeXml(sheetMaterial)}</text>
    <text x="12" y="58" font-family="sans-serif" font-size="11" fill="#222">SCALE: ${escapeXml(sheetScale)}</text>
    <text x="620" y="40" font-family="sans-serif" font-size="11" fill="#222">DATE: ${escapeXml(sheetDate)}</text>
    <text x="620" y="58" font-family="sans-serif" font-size="10" fill="#666">SpaceForge · bbox views</text>
  </g>
</svg>`;
    saveAs(
      new Blob([svg], { type: "image/svg+xml" }),
      `${sheetPartName.replace(/\s+/g, "_")}_drawing.svg`,
    );
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
                onChange={(e) => setSheetScale(e.target.value)}
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
            <button type="button" className="secondary" onClick={exportSvg}>
              Export SVG
            </button>
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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
