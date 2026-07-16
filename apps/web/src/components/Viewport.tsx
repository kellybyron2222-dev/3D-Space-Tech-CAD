import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import type { PlaneId, ProfileKind } from "@spacetech/sfd-lang";
import { ReplicadMesh } from "./ReplicadMesh";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

export interface SketchGhostSpec {
  plane: PlaneId;
  profile: ProfileKind;
  widthMm: number;
  heightMm: number;
  offsetUMm?: number;
  offsetVMm?: number;
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

function SketchGhost({ spec }: { spec: SketchGhostSpec }) {
  const { plane, profile, widthMm, heightMm, offsetUMm = 0, offsetVMm = 0 } =
    spec;
  const geom = useMemo(() => {
    if (profile === "circle") {
      return new THREE.CircleGeometry(widthMm / 2, 48);
    }
    return new THREE.PlaneGeometry(widthMm, heightMm);
  }, [profile, widthMm, heightMm]);

  const rotation = useMemo((): [number, number, number] => {
    if (plane === "front") return [0, 0, 0];
    if (plane === "top") return [-Math.PI / 2, 0, 0];
    return [0, Math.PI / 2, 0];
  }, [plane]);

  const position = useMemo((): [number, number, number] => {
    if (plane === "front") return [offsetUMm, offsetVMm, 0.2];
    if (plane === "top") return [offsetUMm, 0.2, offsetVMm];
    return [0.2, offsetUMm, offsetVMm];
  }, [plane, offsetUMm, offsetVMm]);

  useEffect(
    () => () => {
      geom.dispose();
    },
    [geom],
  );

  return (
    <mesh position={position} rotation={rotation} geometry={geom}>
      <meshBasicMaterial
        color="#c45c26"
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function SelectableBody({
  mesh,
  selected,
  faceIndex,
  onSelect,
}: {
  mesh: TessellationResult;
  selected: boolean;
  faceIndex: number | null;
  onSelect: (faceIndex: number | null) => void;
}) {
  const down = useRef<{ x: number; y: number } | null>(null);
  const groups = mesh.faces.faceGroups ?? [];

  return (
    <group
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        down.current = { x: e.clientX, y: e.clientY };
        e.stopPropagation();
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        if (!down.current) return;
        const dx = e.clientX - down.current.x;
        const dy = e.clientY - down.current.y;
        down.current = null;
        if (dx * dx + dy * dy < 16) {
          e.stopPropagation();
          if (groups.length > 0) {
            const next =
              faceIndex == null ? 0 : (faceIndex + 1) % groups.length;
            onSelect(next);
          } else {
            onSelect(null);
          }
        }
      }}
    >
      <ReplicadMesh
        faces={mesh.faces}
        edges={mesh.edges}
        color={selected ? "#c45c26" : "#5f7d95"}
        highlightFaceIndex={faceIndex}
      />
    </group>
  );
}

export function Viewport({
  mesh,
  status,
  fitNonce = 0,
  onFit,
  selected,
  onSelectBody,
  onClearSelection,
  sketchGhost,
  faceIndex,
  onFaceIndex,
}: {
  mesh: TessellationResult | null;
  status: string;
  fitNonce?: number;
  onFit?: () => void;
  selected?: boolean;
  onSelectBody?: () => void;
  onClearSelection?: () => void;
  sketchGhost?: SketchGhostSpec | null;
  faceIndex?: number | null;
  onFaceIndex?: (i: number | null) => void;
}) {
  const dpr = Math.min(
    typeof window !== "undefined" ? window.devicePixelRatio : 1,
    2,
  );
  const triCount = mesh?.faces.triangles.length
    ? Math.round(mesh.faces.triangles.length / 3)
    : 0;
  const faceCount = mesh?.faces.faceGroups?.length ?? 0;

  return (
    <div className="viewport-canvas cad-viewport">
      <div className="viewport-hud">
        {mesh
          ? `${triCount.toLocaleString()} tris · ${faceCount} faces · click cycles face`
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
          onClearSelection?.();
          onFaceIndex?.(null);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[240, -160, 320]} intensity={1.1} />
        <directionalLight position={[-180, 120, 80]} intensity={0.4} />
        <Grid />
        {sketchGhost ? <SketchGhost spec={sketchGhost} /> : null}
        {mesh ? (
          <>
            <SelectableBody
              mesh={mesh}
              selected={Boolean(selected)}
              faceIndex={faceIndex ?? null}
              onSelect={(i) => {
                onSelectBody?.();
                onFaceIndex?.(i);
              }}
            />
            <FitCamera mesh={mesh} fitNonce={fitNonce} />
          </>
        ) : null}
        <OrbitControls enabled />
      </Canvas>
    </div>
  );
}
