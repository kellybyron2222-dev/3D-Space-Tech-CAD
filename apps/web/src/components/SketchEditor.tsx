import {
  applyDrivingDimension,
  sketchEntitiesFromProfile,
  type SketchConstraint,
  type SketchEntity,
  type SketchFeature,
} from "@spacetech/sfd-lang";

type DrivingDimLabel = "width" | "height" | "dia";

function getDrivingDimValue(sketch: SketchFeature, label: DrivingDimLabel): number {
  const dim = sketch.constraints?.find(
    (c) => c.kind === "dimension" && c.label === label,
  );
  if (dim?.kind === "dimension") return dim.valueMm;
  if (label === "width") return sketch.widthMm;
  if (label === "height") return sketch.heightMm;
  return sketch.widthMm;
}

function patchFromSolved(solved: SketchFeature): Partial<SketchFeature> {
  return {
    entities: solved.entities,
    constraints: solved.constraints,
    widthMm: solved.widthMm,
    heightMm: solved.heightMm,
    profile: solved.profile,
    offsetUMm: solved.offsetUMm,
    offsetVMm: solved.offsetVMm,
  };
}

function newEntityId(): string {
  return `se-${Math.random().toString(36).slice(2, 9)}`;
}

function formatConstraint(c: SketchConstraint): string {
  if (c.kind === "dimension") {
    return `${c.label ?? "dim"}=${c.valueMm}`;
  }
  return c.note ? `${c.kind} (${c.note})` : c.kind;
}

function DrivingDimField({
  label,
  dimLabel,
  sketch,
  onCommit,
}: {
  label: string;
  dimLabel: DrivingDimLabel;
  sketch: SketchFeature;
  onCommit: (solved: SketchFeature) => void;
}) {
  const value = getDrivingDimValue(sketch, dimLabel);

  function commit(nextValue: number) {
    if (!Number.isFinite(nextValue)) return;
    onCommit(applyDrivingDimension(sketch, dimLabel, nextValue));
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={0.1}
        onChange={(e) => commit(Number(e.target.value))}
        onBlur={(e) => commit(Number(e.target.value))}
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={0.1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function EntityFields({
  entity,
  onPatch,
}: {
  entity: SketchEntity;
  onPatch: (next: SketchEntity) => void;
}) {
  if (entity.kind === "line") {
    return (
      <>
        <NumField
          label="X1"
          value={entity.x1}
          onChange={(x1) => onPatch({ ...entity, x1 })}
        />
        <NumField
          label="Y1"
          value={entity.y1}
          onChange={(y1) => onPatch({ ...entity, y1 })}
        />
        <NumField
          label="X2"
          value={entity.x2}
          onChange={(x2) => onPatch({ ...entity, x2 })}
        />
        <NumField
          label="Y2"
          value={entity.y2}
          onChange={(y2) => onPatch({ ...entity, y2 })}
        />
      </>
    );
  }

  if (entity.kind === "rect") {
    return (
      <>
        <NumField
          label="X"
          value={entity.x}
          onChange={(x) => onPatch({ ...entity, x })}
        />
        <NumField
          label="Y"
          value={entity.y}
          onChange={(y) => onPatch({ ...entity, y })}
        />
        <NumField
          label="W"
          value={entity.widthMm}
          onChange={(widthMm) => onPatch({ ...entity, widthMm })}
        />
        <NumField
          label="H"
          value={entity.heightMm}
          onChange={(heightMm) => onPatch({ ...entity, heightMm })}
        />
      </>
    );
  }

  return (
    <>
      <NumField
        label="CX"
        value={entity.cx}
        onChange={(cx) => onPatch({ ...entity, cx })}
      />
      <NumField
        label="CY"
        value={entity.cy}
        onChange={(cy) => onPatch({ ...entity, cy })}
      />
      <NumField
        label="Dia"
        value={entity.diameterMm}
        onChange={(diameterMm) => onPatch({ ...entity, diameterMm })}
      />
    </>
  );
}

export function SketchEditor({
  sketch,
  onChange,
}: {
  sketch: SketchFeature;
  onChange: (patch: Partial<SketchFeature>) => void;
}) {
  const entities = sketch.entities ?? [];
  const hasEntities = entities.length > 0;

  function setEntities(next: SketchEntity[]) {
    onChange({ entities: next });
  }

  function patchEntity(id: string, next: SketchEntity) {
    setEntities(entities.map((e) => (e.id === id ? next : e)));
  }

  function deleteEntity(id: string) {
    setEntities(entities.filter((e) => e.id !== id));
  }

  function addRect() {
    setEntities([
      ...entities,
      {
        id: newEntityId(),
        kind: "rect",
        x: -20,
        y: -15,
        widthMm: 40,
        heightMm: 30,
      },
    ]);
  }

  function addCircle() {
    setEntities([
      ...entities,
      {
        id: newEntityId(),
        kind: "circle",
        cx: 0,
        cy: 0,
        diameterMm: 20,
      },
    ]);
  }

  function addLine() {
    setEntities([
      ...entities,
      {
        id: newEntityId(),
        kind: "line",
        x1: 0,
        y1: 0,
        x2: 30,
        y2: 0,
      },
    ]);
  }

  function initializeFromProfile() {
    onChange({ entities: sketchEntitiesFromProfile(sketch) });
  }

  function commitDrivingDim(solved: SketchFeature) {
    onChange(patchFromSolved(solved));
  }

  function hasConstraint(kind: "horizontal" | "vertical"): boolean {
    return sketch.constraints?.some((c) => c.kind === kind) ?? false;
  }

  function toggleConstraint(kind: "horizontal" | "vertical") {
    const constraints = [...(sketch.constraints ?? [])];
    const idx = constraints.findIndex((c) => c.kind === kind);
    if (idx >= 0) constraints.splice(idx, 1);
    else constraints.push({ kind });
    onChange({ constraints });
  }

  return (
    <div className="sketch-editor">
      <div className="sketch-editor-toolbar">
        <button type="button" className="tool" onClick={addRect}>
          Add Rect
        </button>
        <button type="button" className="tool" onClick={addCircle}>
          Add Circle
        </button>
        <button type="button" className="tool" onClick={addLine}>
          Add Line
        </button>
      </div>

      <div className="sketch-driving-dims">
        <span className="sketch-entity-head" style={{ marginBottom: "0.25rem" }}>
          Driving dims
        </span>
        <div className="props-fields">
          <DrivingDimField
            label="W"
            dimLabel="width"
            sketch={sketch}
            onCommit={commitDrivingDim}
          />
          <DrivingDimField
            label="H"
            dimLabel="height"
            sketch={sketch}
            onCommit={commitDrivingDim}
          />
          <DrivingDimField
            label="Dia"
            dimLabel="dia"
            sketch={sketch}
            onCommit={commitDrivingDim}
          />
        </div>
        <div className="sketch-editor-toolbar" style={{ marginTop: "0.25rem" }}>
          <button
            type="button"
            className={`tool${hasConstraint("horizontal") ? " active" : ""}`}
            onClick={() => toggleConstraint("horizontal")}
          >
            H
          </button>
          <button
            type="button"
            className={`tool${hasConstraint("vertical") ? " active" : ""}`}
            onClick={() => toggleConstraint("vertical")}
          >
            V
          </button>
        </div>
      </div>

      {!hasEntities ? (
        <button
          type="button"
          className="secondary sketch-init-btn"
          onClick={initializeFromProfile}
        >
          Initialize from profile
        </button>
      ) : null}

      {hasEntities ? (
        <div className="sketch-entities">
          {entities.map((entity) => (
            <div key={entity.id} className="sketch-entity">
              <div className="sketch-entity-head">
                <span>{entity.kind}</span>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => deleteEntity(entity.id)}
                >
                  Delete
                </button>
              </div>
              <div className="props-fields">
                <EntityFields
                  entity={entity}
                  onPatch={(next) => patchEntity(entity.id, next)}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {sketch.constraints?.length ? (
        <div className="sketch-constraints">
          {sketch.constraints.map((c, i) => (
            <span key={`${c.kind}-${i}`} className="selection-chip">
              {formatConstraint(c)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
