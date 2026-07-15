import { makeBaseBox, type Shape3D } from "replicad";
import { getParam, type SfdDocument, type SfdPart } from "@spacetech/sfd-lang";

function buildPart(part: SfdPart): Shape3D | null {
  const kind = part.kind ?? "generic";

  if (kind === "box") {
    const w = getParam(part, "widthMm", 100);
    const d = getParam(part, "depthMm", 100);
    const h = getParam(part, "heightMm", 100);
    const wall = getParam(part, "wallMm", 0);
    const outer = makeBaseBox(w, d, h).translate(0, 0, h / 2);
    if (wall <= 0 || wall * 2 >= Math.min(w, d, h)) {
      return outer;
    }
    try {
      // Hollow body so rails/boards remain visible
      const inner = makeBaseBox(
        w - 2 * wall,
        d - 2 * wall,
        h - wall,
      ).translate(0, 0, h / 2 + wall / 2);
      return outer.cut(inner);
    } catch {
      return outer;
    }
  }

  if (kind === "rail") {
    const h = getParam(part, "heightMm", 340.5);
    const s = getParam(part, "sectionMm", 8);
    const x = getParam(part, "xMm", 46);
    const y = getParam(part, "yMm", 46);
    return makeBaseBox(s, s, h).translate(x, y, h / 2);
  }

  if (kind === "board") {
    const z = getParam(part, "zMm", 40);
    const t = getParam(part, "thicknessMm", 1.6);
    // PC/104-ish footprint
    return makeBaseBox(90, 96, t).translate(0, 0, z + t / 2);
  }

  if (kind === "panel") {
    const w = getParam(part, "widthMm", 90);
    const h = getParam(part, "heightMm", 300);
    const t = getParam(part, "thicknessMm", 2);
    const offsetX = getParam(part, "offsetXMm", 51);
    const offsetY = getParam(part, "offsetYMm", 0);
    const z0 = getParam(part, "z0Mm", 20);
    return makeBaseBox(t, w, h).translate(offsetX, offsetY, z0 + h / 2);
  }

  if (kind === "antenna") {
    const length = getParam(part, "lengthMm", 170);
    const dia = getParam(part, "diameterMm", 4);
    const z = getParam(part, "zMm", 340.5);
    // Approximate whip as thin box for robust boolean ops
    return makeBaseBox(dia, dia, length).translate(0, 0, z + length / 2);
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
