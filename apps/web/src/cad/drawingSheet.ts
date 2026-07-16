export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatHoleDia(dia: number): string {
  return Number.isInteger(dia) ? String(dia) : dia.toFixed(1);
}

export function suggestScale(maxDim: number): string {
  if (maxDim > 300) return "1:2";
  if (maxDim < 40) return "2:1";
  return "1:1";
}

export function buildDrawingSvg(opts: {
  size: { x: number; y: number; z: number };
  sheetPartName: string;
  sheetMaterial: string;
  sheetScale: string;
  sheetDate: string;
  holeNote: string | null;
}): string {
  const { size, sheetPartName, sheetMaterial, sheetScale, sheetDate, holeNote } =
    opts;
  const viewScale = 2.2;
  const holeNoteSvg = holeNote
    ? `<text x="640" y="520" font-family="sans-serif" font-size="12" fill="#222">${escapeXml(holeNote)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
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
}

/** HTML wrapper for print / PDF via blob URL (avoids noopener blocking document.write). */
export function buildPrintHtml(sheetPartName: string, svgBody: string): string {
  const svg = svgBody.replace(/^<\?xml[^?]*\?>\s*/, "");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeXml(sheetPartName)}</title>
<style>@page{margin:0.5in}body{margin:0;display:flex;justify-content:center}svg{display:block;max-width:100%;height:auto}</style>
</head><body>${svg}<script>window.onload=function(){window.print()}<\/script></body></html>`;
}
