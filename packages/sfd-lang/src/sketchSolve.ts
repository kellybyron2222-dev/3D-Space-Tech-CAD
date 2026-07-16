import {
  ensureSketchEntities,
  syncSketchProfileFromEntities,
  type SketchConstraint,
  type SketchEntity,
  type SketchFeature,
} from "./features.js";

const MAX_PASSES = 8;
const COINCIDENT_TOLERANCE_MM = 0.5;

type LineEndpointRef = {
  entityIdx: number;
  which: "start" | "end";
};

function cloneEntities(entities: SketchEntity[]): SketchEntity[] {
  return entities.map((e) => ({ ...e }));
}

function setEndpoint(
  entities: SketchEntity[],
  ref: LineEndpointRef,
  x: number,
  y: number,
): void {
  const entity = entities[ref.entityIdx];
  if (entity.kind !== "line") return;
  if (ref.which === "start") {
    entity.x1 = x;
    entity.y1 = y;
  } else {
    entity.x2 = x;
    entity.y2 = y;
  }
}

function snapCircleCentersToLineEndpoints(entities: SketchEntity[]): void {
  const endpoints: { x: number; y: number }[] = [];
  for (const entity of entities) {
    if (entity.kind !== "line") continue;
    endpoints.push({ x: entity.x1, y: entity.y1 });
    endpoints.push({ x: entity.x2, y: entity.y2 });
  }
  if (endpoints.length === 0) return;

  const tolSq = COINCIDENT_TOLERANCE_MM * COINCIDENT_TOLERANCE_MM;
  for (const entity of entities) {
    if (entity.kind !== "circle") continue;
    let bestDistSq = Infinity;
    let snapX: number | undefined;
    let snapY: number | undefined;
    for (const ep of endpoints) {
      const dx = entity.cx - ep.x;
      const dy = entity.cy - ep.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= tolSq && distSq < bestDistSq) {
        bestDistSq = distSq;
        snapX = ep.x;
        snapY = ep.y;
      }
    }
    if (snapX !== undefined && snapY !== undefined) {
      entity.cx = snapX;
      entity.cy = snapY;
    }
  }
}

function applyHorizontalVertical(
  entities: SketchEntity[],
  constraints: SketchConstraint[] | undefined,
): void {
  const horizontal = constraints?.some((c) => c.kind === "horizontal") ?? false;
  const vertical = constraints?.some((c) => c.kind === "vertical") ?? false;
  if (!horizontal && !vertical) return;

  for (const entity of entities) {
    if (entity.kind !== "line") continue;
    if (horizontal) entity.y2 = entity.y1;
    if (vertical) entity.x2 = entity.x1;
  }
}

function mergeCoincidentEndpoints(entities: SketchEntity[]): void {
  const refs: LineEndpointRef[] = [];
  const points: { x: number; y: number }[] = [];

  for (let entityIdx = 0; entityIdx < entities.length; entityIdx++) {
    const entity = entities[entityIdx];
    if (entity.kind !== "line") continue;
    refs.push({ entityIdx, which: "start" });
    points.push({ x: entity.x1, y: entity.y1 });
    refs.push({ entityIdx, which: "end" });
    points.push({ x: entity.x2, y: entity.y2 });
  }

  const n = points.length;
  if (n === 0) return;

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const tolSq = COINCIDENT_TOLERANCE_MM * COINCIDENT_TOLERANCE_MM;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = points[i]!.x - points[j]!.x;
      const dy = points[i]!.y - points[j]!.y;
      if (dx * dx + dy * dy <= tolSq) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  }

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    let sumX = 0;
    let sumY = 0;
    for (const i of indices) {
      sumX += points[i]!.x;
      sumY += points[i]!.y;
    }
    const avgX = sumX / indices.length;
    const avgY = sumY / indices.length;
    for (const i of indices) {
      setEndpoint(entities, refs[i]!, avgX, avgY);
    }
  }

  snapCircleCentersToLineEndpoints(entities);
}

function normalizeDimensionLabel(
  label: string | undefined,
): "width" | "height" | "dia" | undefined {
  if (!label) return undefined;
  const lower = label.toLowerCase();
  if (lower === "width") return "width";
  if (lower === "height") return "height";
  if (lower === "dia" || lower === "diameter") return "dia";
  return undefined;
}

function applyDimensions(
  entities: SketchEntity[],
  constraints: SketchConstraint[] | undefined,
  profile: SketchFeature["profile"],
): void {
  const dims =
    constraints?.filter(
      (c): c is Extract<SketchConstraint, { kind: "dimension" }> =>
        c.kind === "dimension",
    ) ?? [];

  const firstRect = entities.find((e): e is Extract<SketchEntity, { kind: "rect" }> => e.kind === "rect");
  const firstCircle = entities.find(
    (e): e is Extract<SketchEntity, { kind: "circle" }> => e.kind === "circle",
  );

  for (const dim of dims) {
    const label = normalizeDimensionLabel(dim.label);
    const effective =
      label ?? (profile === "circle" ? "dia" : "width");

    if (effective === "width" && firstRect) {
      const cx = firstRect.x + firstRect.widthMm / 2;
      const cy = firstRect.y + firstRect.heightMm / 2;
      firstRect.widthMm = dim.valueMm;
      firstRect.x = cx - dim.valueMm / 2;
      firstRect.y = cy - firstRect.heightMm / 2;
    } else if (effective === "height" && firstRect) {
      const cx = firstRect.x + firstRect.widthMm / 2;
      const cy = firstRect.y + firstRect.heightMm / 2;
      firstRect.heightMm = dim.valueMm;
      firstRect.x = cx - firstRect.widthMm / 2;
      firstRect.y = cy - dim.valueMm / 2;
    } else if (effective === "dia" && firstCircle) {
      firstCircle.diameterMm = dim.valueMm;
    }
  }
}

function applyConstraintPass(
  entities: SketchEntity[],
  constraints: SketchConstraint[] | undefined,
  profile: SketchFeature["profile"],
): void {
  applyHorizontalVertical(entities, constraints);
  mergeCoincidentEndpoints(entities);
  applyDimensions(entities, constraints, profile);
}

function entitiesStable(a: SketchEntity[], b: SketchEntity[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function solveSketch(sketch: SketchFeature): SketchFeature {
  const withEntities = ensureSketchEntities(sketch);
  let entities = cloneEntities(withEntities.entities ?? []);

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = cloneEntities(entities);
    applyConstraintPass(entities, withEntities.constraints, withEntities.profile);
    if (entitiesStable(before, entities)) break;
  }

  return syncSketchProfileFromEntities({
    ...withEntities,
    entities,
  });
}

export function applyDrivingDimension(
  sketch: SketchFeature,
  label: string,
  valueMm: number,
): SketchFeature {
  const constraints = [...(sketch.constraints ?? [])];
  const idx = constraints.findIndex(
    (c) => c.kind === "dimension" && c.label === label,
  );
  const next: Extract<SketchConstraint, { kind: "dimension" }> = {
    kind: "dimension",
    label,
    valueMm,
  };
  if (idx >= 0) constraints[idx] = next;
  else constraints.push(next);

  return solveSketch({ ...sketch, constraints });
}
