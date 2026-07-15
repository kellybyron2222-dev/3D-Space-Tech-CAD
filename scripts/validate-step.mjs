/**
 * Lightweight STEP sanity check for CI (no FreeCAD required).
 * Full FreeCAD roundtrip can be added as an optional job later.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stepPath = resolve(
  root,
  "assets/reference/OSCubeSatStruct_Mk5_3U.step",
);

if (!existsSync(stepPath)) {
  console.error("Missing bundled STEP:", stepPath);
  process.exit(1);
}

const head = readFileSync(stepPath, "utf8").slice(0, 400);
if (!head.includes("ISO-10303-21") && !/HEADER\s*;/i.test(head)) {
  console.error("File does not look like a STEP (ISO-10303-21) exchange:");
  console.error(head.slice(0, 120));
  process.exit(1);
}

const size = readFileSync(stepPath).byteLength;
if (size < 10_000) {
  console.error("STEP unexpectedly small:", size);
  process.exit(1);
}

console.log(`OK: ${stepPath} (${size} bytes) looks like STEP`);
