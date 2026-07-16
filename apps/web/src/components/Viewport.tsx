import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import type { CadFeature, PlaneId, ProfileKind } from "@spacetech/sfd-lang";
import { ReplicadMesh, edgeCountFromLines } from "./ReplicadMesh";
import { FeatureHandles, type FeatureDragPatch } from "./FeatureHandles";
import {
  faceGroupFromTriangleIndex,
  nearestEdgeIndexToPoint,
} from "../cad/selectionMapping";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

export type SketchGhostEntity =
  | { id: string; kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { id: string; kind: "rect"; x: number; y: number; widthMm: number; heightMm: number }
  | { id: string; kind: "circle"; cx: number; cy: number; diameterMm: number };

export interface SketchGhostSpec {
  plane: PlaneId;
  profile: ProfileKind;
  widthMm: number;
  heightMm: number;
  offsetUMm?: number;
  offsetVMm?: number;
  entities?: SketchGhostEntity[];
}

export type SketchPlaceMode = "rect" | "circle" | "line" | null;

export type SketchPlacePayload = {
  kind: "rect" | "circle" | "line";
  /** Plane UV coordinate (mm) */
  u: number;
  v: number;
  /** Second corner / endpoint for rect & line drags */
  u2?: number;
  v2?: number;
};

const GHOST_Z_OFFSET = 0.2;
const SKETCH_PLANE_SIZE = 2000;
const SKETCH_PLACE_DRAG_MM = 3;
const SKETCH_PLACE_DEFAULT_RECT_W = 40;
const SKETCH_PLACE_DEFAULT_RECT_H = 30;
const SKETCH_PLACE_SCREEN_DRAG_PX_SQ = 16;
const GHOST_COLOR = "#c45c26";
const GHOST_OPACITY = 0.35;

function uvToPosition(u: number, v: number, plane: PlaneId): [number, number, number] {
  if (plane === "front") return [u, v, GHOST_Z_OFFSET];
  if (plane === "top") return [u, GHOST_Z_OFFSET, v];
  return [GHOST_Z_OFFSET, u, v];
}

function worldPointToUv(point: THREE.Vector3, plane: PlaneId): { u: number; v: number } {
  if (plane === "front") return { u: point.x, v: point.y };
  if (plane === "top") return { u: point.x, v: point.z };
  return { u: point.y, v: point.z };
}

function planeRotation(plane: PlaneId): [number, number, number] {
  if (plane === "front") return [0, 0, 0];
  if (plane === "top") return [-Math.PI / 2, 0, 0];
  return [0, Math.PI / 2, 0];
}

function OrbitControls({ enabled }: { enabled: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useMemo(
    () => new ThreeOrbitControls(camera, gl.domElement),
    [camera, gl],
  );

  useEffect(() => {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enabled = enabled;
    const onChange = () => invalidate();
    controls.addEventListener("change", onChange);
    return () => {
      controls.removeEventListener("change", onChange);
      controls.dispose();
    };
  }, [controls, invalidate, enabled]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      controls.update();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [controls]);

  return null;
}

function FitCamera({
  mesh,
  fitNonce,
}: {
  mesh: TessellationResult;
  fitNonce: number;
}) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const verts = mesh.faces.vertices;
    if (!verts.length) return;
    const box = new THREE.Box3();
    for (let i = 0; i < verts.length; i += 3) {
      box.expandByPoint(
        new THREE.Vector3(verts[i], verts[i + 1], verts[i + 2]),
      );
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const dist = maxDim * 2.2;
    camera.position.set(
      center.x + dist * 0.7,
      center.y - dist * 0.7,
      center.z + dist * 0.45,
    );
    camera.near = maxDim / 200;
    camera.far = maxDim * 50;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    invalidate();
  }, [mesh, fitNonce, camera, invalidate]);

  return null;
}

function Grid() {
  const helper = useMemo(() => {
    const g = new THREE.GridHelper(500, 25, "#9aa3ad", "#c9c2b6");
    g.rotation.x = Math.PI / 2;
    return g;
  }, []);
  return <primitive object={helper} />;
}

function SketchGhostEntityMesh({
  entity,
  plane,
}: {
  entity: SketchGhostEntity;
  plane: PlaneId;
}) {
  const rotation = planeRotation(plane);

  const lineGeom = useMemo(() => {
    if (entity.kind !== "line") return null;
    const p1 = new THREE.Vector3(...uvToPosition(entity.x1, entity.y1, plane));
    const p2 = new THREE.Vector3(...uvToPosition(entity.x2, entity.y2, plane));
    return new THREE.BufferGeometry().setFromPoints([p1, p2]);
  }, [entity, plane]);

  const rectGeom = useMemo(() => {
    if (entity.kind !== "rect") return null;
    const planeGeom = new THREE.PlaneGeometry(entity.widthMm, entity.heightMm);
    const edges = new THREE.EdgesGeometry(planeGeom);
    planeGeom.dispose();
    return edges;
  }, [entity]);

  const circleGeom = useMemo(() => {
    if (entity.kind !== "circle") return null;
    const circle = new THREE.CircleGeometry(entity.diameterMm / 2, 48);
    const edges = new THREE.EdgesGeometry(circle);
    circle.dispose();
    return edges;
  }, [entity]);

  const rectPosition = useMemo((): [number, number, number] | null => {
    if (entity.kind !== "rect") return null;
    return uvToPosition(
      entity.x + entity.widthMm / 2,
      entity.y + entity.heightMm / 2,
      plane,
    );
  }, [entity, plane]);

  const circlePosition = useMemo((): [number, number, number] | null => {
    if (entity.kind !== "circle") return null;
    return uvToPosition(entity.cx, entity.cy, plane);
  }, [entity, plane]);

  useEffect(
    () => () => {
      lineGeom?.dispose();
      rectGeom?.dispose();
      circleGeom?.dispose();
    },
    [lineGeom, rectGeom, circleGeom],
  );

  if (entity.kind === "line" && lineGeom) {
    return (
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial
          color={GHOST_COLOR}
          transparent
          opacity={GHOST_OPACITY}
          depthWrite={false}
        />
      </lineSegments>
    );
  }

  if (entity.kind === "rect" && rectGeom && rectPosition) {
    return (
      <lineSegments geometry={rectGeom} position={rectPosition} rotation={rotation}>
        <lineBasicMaterial
          color={GHOST_COLOR}
          transparent
          opacity={GHOST_OPACITY}
          depthWrite={false}
        />
      </lineSegments>
    );
  }

  if (entity.kind === "circle" && circleGeom && circlePosition) {
    return (
      <lineSegments
        geometry={circleGeom}
        position={circlePosition}
        rotation={rotation}
      >
        <lineBasicMaterial
          color={GHOST_COLOR}
          transparent
          opacity={GHOST_OPACITY}
          depthWrite={false}
        />
      </lineSegments>
    );
  }

  return null;
}

function SketchGhostProfile({
  plane,
  profile,
  widthMm,
  heightMm,
  offsetUMm,
  offsetVMm,
}: {
  plane: PlaneId;
  profile: ProfileKind;
  widthMm: number;
  heightMm: number;
  offsetUMm: number;
  offsetVMm: number;
}) {
  const geom = useMemo(() => {
    if (profile === "circle") {
      return new THREE.CircleGeometry(widthMm / 2, 48);
    }
    return new THREE.PlaneGeometry(widthMm, heightMm);
  }, [profile, widthMm, heightMm]);

  const rotation = planeRotation(plane);
  const position = useMemo(
    (): [number, number, number] => uvToPosition(offsetUMm, offsetVMm, plane),
    [plane, offsetUMm, offsetVMm],
  );

  useEffect(
    () => () => {
      geom.dispose();
    },
    [geom],
  );

  return (
    <mesh position={position} rotation={rotation} geometry={geom}>
      <meshBasicMaterial
        color={GHOST_COLOR}
        transparent
        opacity={GHOST_OPACITY}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function SketchPlacePlane({
  plane,
  mode,
  onPlace,
}: {
  plane: PlaneId;
  mode: Exclude<SketchPlaceMode, null>;
  onPlace: (entity: SketchPlacePayload) => void;
}) {
  const down = useRef<{ u: number; v: number; x: number; y: number } | null>(null);
  const rotation = planeRotation(plane);
  const position = useMemo((): [number, number, number] => uvToPosition(0, 0, plane), [plane]);

  const finish = (e: ThreeEvent<PointerEvent>) => {
    if (!down.current) return;
    const start = down.current;
    down.current = null;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const screenDragSq = dx * dx + dy * dy;
    const endUv = worldPointToUv(e.point, plane);

    if (mode === "circle") {
      if (screenDragSq < SKETCH_PLACE_SCREEN_DRAG_PX_SQ) {
        onPlace({ kind: "circle", u: endUv.u, v: endUv.v });
      }
      return;
    }

    const du = endUv.u - start.u;
    const dv = endUv.v - start.v;
    if (mode === "rect") {
      if (Math.hypot(du, dv) >= SKETCH_PLACE_DRAG_MM) {
        onPlace({
          kind: "rect",
          u: start.u,
          v: start.v,
          u2: endUv.u,
          v2: endUv.v,
        });
      } else if (screenDragSq < SKETCH_PLACE_SCREEN_DRAG_PX_SQ) {
        onPlace({
          kind: "rect",
          u: start.u - SKETCH_PLACE_DEFAULT_RECT_W / 2,
          v: start.v - SKETCH_PLACE_DEFAULT_RECT_H / 2,
          u2: start.u + SKETCH_PLACE_DEFAULT_RECT_W / 2,
          v2: start.v + SKETCH_PLACE_DEFAULT_RECT_H / 2,
        });
      }
      return;
    }

    if (Math.hypot(du, dv) >= SKETCH_PLACE_DRAG_MM) {
      onPlace({
        kind: mode,
        u: start.u,
        v: start.v,
        u2: endUv.u,
        v2: endUv.v,
      });
    }
  };

  return (
    <mesh
      position={position}
      rotation={rotation}
      visible={false}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const uv = worldPointToUv(e.point, plane);
        down.current = { u: uv.u, v: uv.v, x: e.clientX, y: e.clientY };
        (e.nativeEvent.target as Element | null)?.setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        finish(e);
        try {
          (e.nativeEvent.target as Element | null)?.releasePointerCapture?.(
            e.pointerId,
          );
        } catch {
          /* pointer may already be released */
        }
      }}
      onPointerCancel={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        down.current = null;
      }}
    >
      <planeGeometry args={[SKETCH_PLANE_SIZE, SKETCH_PLANE_SIZE]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function SketchGhost({ spec }: { spec: SketchGhostSpec }) {
  const { plane, profile, widthMm, heightMm, offsetUMm = 0, offsetVMm = 0, entities } =
    spec;

  if (entities?.length) {
    return (
      <group>
        {entities.map((entity) => (
          <SketchGhostEntityMesh key={entity.id} entity={entity} plane={plane} />
        ))}
      </group>
    );
  }

  return (
    <SketchGhostProfile
      plane={plane}
      profile={profile}
      widthMm={widthMm}
      heightMm={heightMm}
      offsetUMm={offsetUMm}
      offsetVMm={offsetVMm}
    />
  );
}

function RaycastSuppressor({
  suppress,
  children,
}: {
  suppress: boolean;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!suppress || !ref.current) return;
    const restored: { obj: THREE.Object3D; fn: THREE.Object3D["raycast"] }[] = [];
    ref.current.traverse((obj) => {
      if (typeof obj.raycast !== "function") return;
      const fn = obj.raycast.bind(obj);
      restored.push({ obj, fn });
      obj.raycast = () => undefined;
    });
    return () => {
      for (const { obj, fn } of restored) obj.raycast = fn;
    };
  }, [suppress]);

  return <group ref={ref}>{children}</group>;
}

function ToolPlaceGhost({
  kind,
  point,
  sizeMm,
}: {
  kind: "hole" | "cut";
  point: { x: number; y: number; z: number };
  sizeMm: number;
}) {
  // Scene is Z-up; Three cylinder is Y-up — rotate onto Z for through-cut preview.
  const r = Math.max(1.5, sizeMm / 2);
  const h = kind === "hole" ? 14 : 20;
  return (
    <mesh
      position={[point.x, point.y, point.z]}
      rotation={[Math.PI / 2, 0, 0]}
      renderOrder={3}
    >
      <cylinderGeometry args={[r, r, h, 28]} />
      <meshStandardMaterial
        color="#c45c26"
        transparent
        opacity={0.4}
        depthWrite={false}
        metalness={0.1}
        roughness={0.55}
      />
    </mesh>
  );
}

function SelectableBody({
  mesh,
  selected,
  faceIndex,
  edgeIndex,
  onSelectFace,
  onSelectEdge,
  onHoverPoint,
  onPlaceSize,
  onPlaceSizing,
  placementTool = null,
  selectionEnabled = true,
}: {
  mesh: TessellationResult;
  selected: boolean;
  faceIndex: number | null;
  edgeIndex: number | null;
  onSelectFace: (
    faceIndex: number | null,
    opts?: {
      altKey?: boolean;
      edgeSelect?: boolean;
      point?: { x: number; y: number; z: number };
      sizeMm?: number;
    },
  ) => void;
  onSelectEdge: (
    edgeIndex: number | null,
    opts?: {
      altKey?: boolean;
      edgeSelect?: boolean;
      point?: { x: number; y: number; z: number };
    },
  ) => void;
  onHoverPoint?: (point: { x: number; y: number; z: number } | null) => void;
  onPlaceSize?: (sizeMm: number | null) => void;
  onPlaceSizing?: (sizing: boolean) => void;
  placementTool?: "hole" | "cut" | null;
  selectionEnabled?: boolean;
}) {
  const down = useRef<{
    x: number;
    y: number;
    wx: number;
    wy: number;
    wz: number;
  } | null>(null);
  const groups = mesh.faces.faceGroups ?? [];
  void faceIndex;
  void edgeIndex;

  return (
    <group
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (!selectionEnabled) return;
        down.current = {
          x: e.clientX,
          y: e.clientY,
          wx: e.point.x,
          wy: e.point.y,
          wz: e.point.z,
        };
        if (placementTool) {
          onPlaceSizing?.(true);
          onHoverPoint?.({ x: e.point.x, y: e.point.y, z: e.point.z });
          onPlaceSize?.(placementTool === "hole" ? 6 : 12);
        }
        e.stopPropagation();
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (!selectionEnabled) return;
        if (placementTool && down.current) {
          const center = down.current;
          onHoverPoint?.({ x: center.wx, y: center.wy, z: center.wz });
          const dist = Math.hypot(
            e.point.x - center.wx,
            e.point.y - center.wy,
          );
          const size =
            dist < 1.5
              ? placementTool === "hole"
                ? 6
                : 12
              : Math.max(3, Math.round(dist * 2 * 2) / 2);
          onPlaceSize?.(size);
          return;
        }
        onHoverPoint?.({ x: e.point.x, y: e.point.y, z: e.point.z });
      }}
      onPointerOut={() => {
        if (down.current && placementTool) return;
        onHoverPoint?.(null);
        onPlaceSize?.(null);
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        if (!selectionEnabled || !down.current) return;
        const start = down.current;
        down.current = null;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        const screenDragSq = dx * dx + dy * dy;

        if (placementTool && !e.shiftKey) {
          e.stopPropagation();
          onPlaceSizing?.(false);
          const dist = Math.hypot(e.point.x - start.wx, e.point.y - start.wy);
          const sizeMm =
            dist < 1.5
              ? placementTool === "hole"
                ? 6
                : 12
              : Math.max(3, Math.round(dist * 2 * 2) / 2);
          const point = { x: start.wx, y: start.wy, z: start.wz };
          const hitFace = faceGroupFromTriangleIndex(e.faceIndex, groups);
          onSelectFace(hitFace, { altKey: e.altKey, point, sizeMm });
          onPlaceSize?.(null);
          return;
        }

        if (screenDragSq < 16) {
          e.stopPropagation();
          const point = {
            x: e.point.x,
            y: e.point.y,
            z: e.point.z,
          };
          if (e.shiftKey) {
            const nearest = nearestEdgeIndexToPoint(point, mesh.edges.lines);
            onSelectEdge(nearest, {
              altKey: e.altKey,
              edgeSelect: true,
              point,
            });
          } else {
            const hitFace = faceGroupFromTriangleIndex(e.faceIndex, groups);
            onSelectFace(hitFace, { altKey: e.altKey, point });
          }
        }
      }}
    >
      <ReplicadMesh
        faces={mesh.faces}
        edges={mesh.edges}
        color={selected ? "#c45c26" : "#5f7d95"}
        highlightFaceIndex={faceIndex}
        highlightEdgeIndex={edgeIndex}
      />
    </group>
  );
}

export type ViewportBodySelectHandler = (
  faceIndex: number | null,
  opts?: {
    altKey?: boolean;
    edgeSelect?: boolean;
    point?: { x: number; y: number; z: number };
    sizeMm?: number;
  },
) => void;

export function Viewport({
  mesh,
  status,
  fitNonce = 0,
  onFit,
  selected,
  onSelectBody,
  onClearSelection,
  sketchGhost,
  sketchPlaceMode = null,
  onSketchPlace,
  faceIndex,
  edgeIndex,
  onEdgeIndex,
  editFeature = null,
  onFeatureDrag,
  onFeatureDragStart,
  onFeatureDragEnd,
  toolHint = null,
  placementCrosshair = false,
  dimensionReadout = null,
  placementTool = null,
}: {
  mesh: TessellationResult | null;
  status: string;
  fitNonce?: number;
  onFit?: () => void;
  selected?: boolean;
  onSelectBody?: ViewportBodySelectHandler;
  onClearSelection?: () => void;
  sketchGhost?: SketchGhostSpec | null;
  sketchPlaceMode?: SketchPlaceMode;
  onSketchPlace?: (entity: SketchPlacePayload) => void;
  faceIndex?: number | null;
  edgeIndex?: number | null;
  onEdgeIndex?: (i: number | null) => void;
  /** Selected box/hole/extrude/revolve/cut — shows drag handles in the viewport */
  editFeature?: CadFeature | null;
  onFeatureDrag?: (patch: FeatureDragPatch) => void;
  onFeatureDragStart?: () => void;
  onFeatureDragEnd?: () => void;
  toolHint?: string | null;
  /** Crosshair cursor for placement tools (hole/cut/etc.) — not select mode */
  placementCrosshair?: boolean;
  /** Live dims for selected editable feature */
  dimensionReadout?: string | null;
  /** Active place tool that shows a hover ghost */
  placementTool?: "hole" | "cut" | null;
}) {
  const [handleDragging, setHandleDragging] = useState(false);
  const [placeSizing, setPlaceSizing] = useState(false);
  const [placeSizeMm, setPlaceSizeMm] = useState<number | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const hoverSnapMm = 0.5;
  const setHoverPointSnapped = useCallback(
    (point: { x: number; y: number; z: number } | null) => {
      if (!point) {
        setHoverPoint(null);
        return;
      }
      const snapped = {
        x: Math.round(point.x / hoverSnapMm) * hoverSnapMm,
        y: Math.round(point.y / hoverSnapMm) * hoverSnapMm,
        z: point.z,
      };
      setHoverPoint((prev) =>
        prev && prev.x === snapped.x && prev.y === snapped.y ? prev : snapped,
      );
    },
    [],
  );
  const dpr = Math.min(
    typeof window !== "undefined" ? window.devicePixelRatio : 1,
    2,
  );
  const triCount = mesh?.faces.triangles.length
    ? Math.round(mesh.faces.triangles.length / 3)
    : 0;
  const faceCount = mesh?.faces.faceGroups?.length ?? 0;
  const edgeCount = edgeCountFromLines(mesh?.edges.lines);
  const placingSketch = Boolean(sketchGhost && sketchPlaceMode && onSketchPlace);
  const canEditHandles =
    Boolean(editFeature && onFeatureDrag) &&
    (editFeature?.kind === "box" ||
      editFeature?.kind === "hole" ||
      editFeature?.kind === "extrude" ||
      editFeature?.kind === "revolve" ||
      editFeature?.kind === "cut");
  const placeHint =
    sketchPlaceMode === "circle"
      ? "click to place circle"
      : sketchPlaceMode === "rect"
        ? "drag to place rect"
        : sketchPlaceMode === "line"
          ? "drag to place line"
          : null;
  const ghostSizeMm =
    placeSizeMm ?? (placementTool === "cut" ? 12 : 6);
  const hoverReadout =
    placementTool && hoverPoint
      ? placeSizing
        ? `${placementTool === "hole" ? "Hole" : "Cut"} Ø${ghostSizeMm.toFixed(1)} @ (${hoverPoint.x.toFixed(1)}, ${hoverPoint.y.toFixed(1)}) — release to place`
        : `${placementTool === "hole" ? "Hole" : "Cut"} @ (${hoverPoint.x.toFixed(1)}, ${hoverPoint.y.toFixed(1)}) — click or drag to size`
      : null;

  useEffect(() => {
    if (!placementTool) {
      setHoverPoint(null);
      setPlaceSizeMm(null);
      setPlaceSizing(false);
    }
  }, [placementTool]);

  return (
    <div
      className={`viewport-canvas cad-viewport${placementCrosshair ? " tool-cursor-crosshair" : ""}`}
    >
      <div
        className={`viewport-hud${placingSketch || toolHint || handleDragging ? " viewport-hud--placing" : ""}`}
      >
        {placingSketch && placeHint
          ? `[SKETCH] ${placeHint}`
          : toolHint
            ? `[TOOL] ${hoverReadout ?? toolHint}`
            : handleDragging && dimensionReadout
              ? `[EDIT] ${dimensionReadout}`
              : mesh
                ? `${triCount.toLocaleString()} tris · ${faceCount} faces · ${edgeCount} edges · click face · Shift+click nearest edge${edgeIndex != null ? ` · edge #${edgeIndex}` : ""}${dimensionReadout ? ` · ${dimensionReadout}` : ""}${canEditHandles ? " · drag handles" : ""}`
                : status}
      </div>
      {mesh && onFit ? (
        <button type="button" className="viewport-fit" onClick={onFit}>
          Fit
        </button>
      ) : null}
      {!mesh ? <div className="viewport-overlay">{status}</div> : null}
      <Canvas
        frameloop="always"
        dpr={dpr}
        camera={{ position: [280, -280, 200], fov: 35, near: 0.1, far: 8000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#dfe4e8");
        }}
        onPointerMissed={() => {
          if (placingSketch) return;
          onClearSelection?.();
          onEdgeIndex?.(null);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[240, -160, 320]} intensity={1.1} />
        <directionalLight position={[-180, 120, 80]} intensity={0.4} />
        <Grid />
        {sketchGhost ? <SketchGhost spec={sketchGhost} /> : null}
        {placingSketch ? (
          <SketchPlacePlane
            plane={sketchGhost!.plane}
            mode={sketchPlaceMode!}
            onPlace={onSketchPlace!}
          />
        ) : null}
        {mesh ? (
          <>
            <RaycastSuppressor suppress={placingSketch}>
              <SelectableBody
                mesh={mesh}
                selected={Boolean(selected)}
                faceIndex={faceIndex ?? null}
                edgeIndex={edgeIndex ?? null}
                selectionEnabled={!placingSketch}
                placementTool={placementTool}
                onHoverPoint={placementTool ? setHoverPointSnapped : undefined}
                onPlaceSize={setPlaceSizeMm}
                onPlaceSizing={setPlaceSizing}
                onSelectFace={(i, opts) => {
                  onSelectBody?.(i, opts);
                }}
                onSelectEdge={(i, opts) => {
                  onSelectBody?.(null, { ...opts, edgeSelect: true });
                  onEdgeIndex?.(i);
                }}
              />
            </RaycastSuppressor>
            <FitCamera mesh={mesh} fitNonce={fitNonce} />
            {placementTool && hoverPoint ? (
              <ToolPlaceGhost
                kind={placementTool}
                point={hoverPoint}
                sizeMm={ghostSizeMm}
              />
            ) : null}
            {canEditHandles && editFeature && onFeatureDrag ? (
              <FeatureHandles
                feature={editFeature}
                onPatch={onFeatureDrag}
                onDragState={(dragging) => {
                  setHandleDragging(dragging);
                  if (dragging) onFeatureDragStart?.();
                  else onFeatureDragEnd?.();
                }}
              />
            ) : null}
          </>
        ) : null}
        <OrbitControls
          enabled={!handleDragging && !placingSketch && !placeSizing}
        />
      </Canvas>
    </div>
  );
}
