/**
 * Probe bracket wall → base height / mount-hole depth bindings.
 * Exits 1 if any hole.depthMm <= wall (not a through hole).
 */
import {
  applyParameters,
  createBracketDemo,
  setParameter,
} from "../packages/sfd-lang/dist/index.js";

const walls = [4, 7, 12, 20];
let failed = false;

for (const wall of walls) {
  const doc = setParameter(createBracketDemo(), "wall", wall);
  // Sanity: explicit applyParameters matches setParameter path
  const baseAlt = applyParameters({
    ...createBracketDemo(),
    parameters: { wall },
  }).features.find((f) => f.id === "f-base");
  if (baseAlt?.kind !== "box" || baseAlt.heightMm !== wall) {
    console.error(`FAIL applyParameters wall=${wall}`);
    failed = true;
  }
  const base = doc.features.find((f) => f.id === "f-base");
  const hole = doc.features.find((f) => f.id === "f-hole");
  const baseHeightMm = base?.kind === "box" ? base.heightMm : NaN;
  const holeDepthMm = hole?.kind === "hole" ? hole.depthMm : NaN;
  console.log(
    `wall=${wall} base.heightMm=${baseHeightMm} hole.depthMm=${holeDepthMm}`,
  );
  if (!(holeDepthMm > wall)) {
    console.error(
      `FAIL wall=${wall}: hole.depthMm=${holeDepthMm} must be > wall`,
    );
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
