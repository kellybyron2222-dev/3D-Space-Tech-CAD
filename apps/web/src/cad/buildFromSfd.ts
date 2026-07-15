import { makeBaseBox, type Shape3D } from "replicad";
import { getParam, type SfdDocument, type SfdPart } from "@spacetech/sfd-lang";

function buildPart(part: SfdPart): Shape3D | null {
  const kind = part.kind ?? "generic";

  if (kind === "box") {
    const w = getParam(part, "widthMm", 100);
    const d = getParam(part, "depthMm", 100);
    const h = getParam(part, "heightMm", 100);
    return makeBaseBox(w, d, h).translate(0, 0, h / 2);
  }

  if (kind === "panel") {
    const w = getParam(part, "widthMm", 90);
    const h = getParam(part, "heightMm", 300);
    const t = getParam(part, "thicknessMm", 2);
    const offsetX = getParam(part, "offsetXMm", 51);
    return makeBaseBox(t, w, h).translate(offsetX, 0, h / 2 + 20);
  }

  return null;
}

/** Fuse SFD parts into a single solid for mesh / STEP export. */
export function buildShapeFromSfd(doc: SfdDocument): Shape3D {
  const shapes: Shape3D[] = [];
  for (const part of doc.parts) {
    const shape = buildPart(part);
    if (shape) shapes.push(shape);
  }

  if (shapes.length === 0) {
    return makeBaseBox(100, 100, 100).translate(0, 0, 50);
  }

  let result = shapes[0]!;
  for (let i = 1; i < shapes.length; i++) {
    result = result.fuse(shapes[i]!);
  }
  return result;
}
