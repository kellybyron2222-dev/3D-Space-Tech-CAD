import { useMemo } from "react";
import { saveAs } from "file-saver";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { meshBounds } from "../cad/meshBounds";

/** Associative drawing v0 — ortho boxes + overall dims from live mesh bbox. */
export function DrawingPanel({
  partName,
  mesh,
}: {
  partName: string;
  mesh: TessellationResult | null;
}) {
  const bounds = useMemo(() => meshBounds(mesh), [mesh]);

  function exportSvg() {
    if (!bounds) return;
    const { size } = bounds;
    const scale = 2.2;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640">
  <rect width="100%" height="100%" fill="#f7f5f0"/>
  <text x="28" y="36" font-family="Georgia, serif" font-size="22" fill="#1a1a1a">${escapeXml(partName)}</text>
  <text x="28" y="58" font-family="sans-serif" font-size="12" fill="#555">Associative drawing v0 · Overall ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm</text>
  <g transform="translate(40,90)">
    <text font-family="sans-serif" font-size="11" fill="#333">FRONT (X–Z)</text>
    <rect x="0" y="16" width="${size.x * scale}" height="${size.z * scale}" fill="none" stroke="#222" stroke-width="1.5"/>
    <text x="${(size.x * scale) / 2}" y="${size.z * scale + 34}" text-anchor="middle" font-size="11">${size.x.toFixed(1)}</text>
  </g>
  <g transform="translate(320,90)">
    <text font-family="sans-serif" font-size="11" fill="#333">TOP (X–Y)</text>
    <rect x="0" y="16" width="${size.x * scale}" height="${size.y * scale}" fill="none" stroke="#222" stroke-width="1.5"/>
    <text x="${(size.x * scale) / 2}" y="${size.y * scale + 34}" text-anchor="middle" font-size="11">${size.x.toFixed(1)}</text>
  </g>
  <g transform="translate(600,90)">
    <text font-family="sans-serif" font-size="11" fill="#333">RIGHT (Y–Z)</text>
    <rect x="0" y="16" width="${size.y * scale}" height="${size.z * scale}" fill="none" stroke="#222" stroke-width="1.5"/>
    <text x="${(size.y * scale) / 2}" y="${size.z * scale + 34}" text-anchor="middle" font-size="11">${size.y.toFixed(1)}</text>
  </g>
  <text x="28" y="600" font-family="sans-serif" font-size="11" fill="#666">SpaceForge · bbox views (not true silhouette) · ${new Date().toISOString().slice(0, 10)}</text>
</svg>`;
    saveAs(
      new Blob([svg], { type: "image/svg+xml" }),
      `${partName.replace(/\s+/g, "_")}_drawing.svg`,
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

  return (
    <div className="drawing-stub">
      <div className="drawing-sheet">
        <div className="drawing-titleblock">
          <strong>{partName}</strong>
          <span>Drawing · associative v0 (bbox)</span>
          <span>
            {size.x.toFixed(1)} × {size.y.toFixed(1)} × {size.z.toFixed(1)} mm
          </span>
          <button type="button" className="secondary" onClick={exportSvg}>
            Export SVG
          </button>
        </div>
        <div className="drawing-views">
          {viewBox(size.x, size.z, "FRONT (X–Z)", size.x, size.z)}
          {viewBox(size.x, size.y, "TOP (X–Y)", size.x, size.y)}
          {viewBox(size.y, size.z, "RIGHT (Y–Z)", size.y, size.z)}
          <div className="drawing-view">
            <span>NOTES</span>
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
