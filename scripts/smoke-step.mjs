/**
 * Smoke: Bracket-Demo feature doc serializes and has expected exit-path features.
 * Full OCCT STEP export runs in the browser worker; this guards the feature graph.
 */
import {
  createBracketDemo,
  serializeFeatureDocument,
  parseFeatureDocument,
  activeFeatures,
} from "../packages/sfd-lang/dist/index.js";

const doc = createBracketDemo();
const raw = serializeFeatureDocument(doc);
const again = parseFeatureDocument(raw);
const kinds = new Set(activeFeatures(again).map((f) => f.kind));

const need = ["box", "hole", "fillet"];
const missing = need.filter((k) => !kinds.has(k));
if (missing.length) {
  console.error("FAIL exit-path features missing:", missing.join(", "));
  process.exit(1);
}
if (!raw.includes("Bracket-Demo")) {
  console.error("FAIL serialize missing name");
  process.exit(1);
}
console.log(
  "OK smoke-step: Bracket-Demo has",
  [...kinds].join(", "),
  `· ${raw.length} bytes JSON`,
);
