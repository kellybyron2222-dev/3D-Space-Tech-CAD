import { useMemo, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { CadFeature } from "@spacetech/sfd-lang";

export type FeatureDragPatch = Partial<CadFeature>;

type HandleKind =
  | "moveXY"
  | "width"
  | "depth"
  | "height"
  | "holeXY"
  | "holeDia";

/**
 * Viewport drag handles for the selected solid feature (box / hole).
 * Dragging updates feature params; parent rebuilds the B-rep.
 */
export function FeatureHandles({
  feature,
  onPatch,
  onDragState,
}: {
  feature: CadFeature;
  onPatch: (patch: FeatureDragPatch) => void;
  onDragState?: (dragging: boolean) => void;
}) {
  if (feature.kind === "box") {
    return (
      <BoxHandles
        feature={feature}
        onPatch={onPatch}
        onDragState={onDragState}
      />
    );
  }
  if (feature.kind === "hole") {
    return (
      <HoleHandles
        feature={feature}
        onPatch={onPatch}
        onDragState={onDragState}
      />
    );
  }
  return null;
}

function BoxHandles({
  feature,
  onPatch,
  onDragState,
}: {
  feature: Extract<CadFeature, { kind: "box" }>;
  onPatch: (patch: FeatureDragPatch) => void;
  onDragState?: (dragging: boolean) => void;
}) {
  const x = feature.xMm ?? 0;
  const y = feature.yMm ?? 0;
  const z = feature.zMm ?? 0;
  const w = feature.widthMm;
  const d = feature.depthMm;
  const h = feature.heightMm;
  const cx = x;
  const cy = y;
  const topZ = z + h;

  return (
    <group>
      <DragHandle
        kind="moveXY"
        position={[cx, cy, topZ + 2]}
        color="#c45c26"
        label="move"
        onDragState={onDragState}
        onDrag={(delta) => {
          onPatch({
            xMm: x + delta.x,
            yMm: y + delta.y,
          });
        }}
      />
      <DragHandle
        kind="width"
        position={[cx + w / 2, cy, z + h / 2]}
        color="#2a6f8f"
        label="W"
        axis="x"
        onDragState={onDragState}
        onDrag={(delta) => {
          onPatch({ widthMm: Math.max(1, w + delta.x * 2) });
        }}
      />
      <DragHandle
        kind="depth"
        position={[cx, cy + d / 2, z + h / 2]}
        color="#2a6f8f"
        label="D"
        axis="y"
        onDragState={onDragState}
        onDrag={(delta) => {
          onPatch({ depthMm: Math.max(1, d + delta.y * 2) });
        }}
      />
      <DragHandle
        kind="height"
        position={[cx, cy, topZ]}
        color="#5a8f2a"
        label="H"
        axis="z"
        onDragState={onDragState}
        onDrag={(delta) => {
          onPatch({ heightMm: Math.max(0.5, h + delta.z) });
        }}
      />
    </group>
  );
}

function HoleHandles({
  feature,
  onPatch,
  onDragState,
}: {
  feature: Extract<CadFeature, { kind: "hole" }>;
  onPatch: (patch: FeatureDragPatch) => void;
  onDragState?: (dragging: boolean) => void;
}) {
  const x = feature.xMm ?? 0;
  const y = feature.yMm ?? 0;
  const z = feature.zMm ?? 0;
  const dia = feature.diameterMm;
  const depth = feature.depthMm;

  return (
    <group>
      <DragHandle
        kind="holeXY"
        position={[x, y, z + depth + 2]}
        color="#c45c26"
        label="move"
        onDragState={onDragState}
        onDrag={(delta) => {
          onPatch({
            xMm: x + delta.x,
            yMm: y + delta.y,
          });
        }}
      />
      <DragHandle
        kind="holeDia"
        position={[x + dia / 2, y, z + depth / 2]}
        color="#2a6f8f"
        label="Ø"
        axis="x"
        onDragState={onDragState}
        onDrag={(delta) => {
          onPatch({ diameterMm: Math.max(0.5, dia + delta.x * 2) });
        }}
      />
    </group>
  );
}

function DragHandle({
  position,
  color,
  label,
  axis,
  onDrag,
  onDragState,
}: {
  kind: HandleKind;
  position: [number, number, number];
  color: string;
  label: string;
  axis?: "x" | "y" | "z";
  onDrag: (delta: { x: number; y: number; z: number }) => void;
  onDragState?: (dragging: boolean) => void;
}) {
  const { camera, gl, size } = useThree();
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const geom = useMemo(() => new THREE.SphereGeometry(2.2, 16, 12), []);

  const projectDelta = (clientX: number, clientY: number) => {
    if (!last.current) return { x: 0, y: 0, z: 0 };
    const dxPx = clientX - last.current.x;
    const dyPx = clientY - last.current.y;
    last.current = { x: clientX, y: clientY };

    // Approximate mm per pixel from camera distance
    const dist = camera.position.length();
    const mmPerPx = Math.max(0.05, (dist / Math.max(size.height, 1)) * 0.85);

    let x = 0;
    let y = 0;
    let z = 0;
    if (!axis) {
      // move in XY: screen X → world X, screen Y → world -Y (typical)
      x = dxPx * mmPerPx;
      y = -dyPx * mmPerPx;
    } else if (axis === "x") {
      x = dxPx * mmPerPx;
    } else if (axis === "y") {
      y = -dyPx * mmPerPx;
    } else {
      z = -dyPx * mmPerPx;
    }
    return { x, y, z };
  };

  return (
    <mesh
      position={position}
      geometry={geom}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
        dragging.current = true;
        last.current = { x: e.clientX, y: e.clientY };
        onDragState?.(true);
        gl.domElement.style.cursor = "grabbing";
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        dragging.current = false;
        last.current = null;
        onDragState?.(false);
        gl.domElement.style.cursor = "";
      }}
      onPointerLeave={() => {
        if (!dragging.current) return;
        dragging.current = false;
        last.current = null;
        onDragState?.(false);
        gl.domElement.style.cursor = "";
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (!dragging.current) return;
        e.stopPropagation();
        onDrag(projectDelta(e.clientX, e.clientY));
      }}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.25}
        metalness={0.2}
        roughness={0.35}
      />
      {/* label via html would need drei; skip for MVP */}
      <group visible={false}>{label}</group>
    </mesh>
  );
}
