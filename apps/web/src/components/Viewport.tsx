import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { ReplicadMesh } from "./ReplicadMesh";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

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

function DatumPlanes() {
  return (
    <group>
      {/* Front XY */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial
          color="#3d6e8c"
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function SelectableBody({
  mesh,
  selected,
  onSelect,
}: {
  mesh: TessellationResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const down = useRef<{ x: number; y: number } | null>(null);

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
          onSelect();
        }
      }}
    >
      <ReplicadMesh
        faces={mesh.faces}
        edges={mesh.edges}
        color={selected ? "#c45c26" : "#5f7d95"}
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
}: {
  mesh: TessellationResult | null;
  status: string;
  fitNonce?: number;
  onFit?: () => void;
  selected?: boolean;
  onSelectBody?: () => void;
  onClearSelection?: () => void;
}) {
  const dpr = Math.min(
    typeof window !== "undefined" ? window.devicePixelRatio : 1,
    2,
  );
  const triCount = mesh?.faces.triangles.length
    ? Math.round(mesh.faces.triangles.length / 3)
    : 0;

  return (
    <div className="viewport-canvas cad-viewport">
      <div className="viewport-hud">
        {mesh
          ? `${triCount.toLocaleString()} tris · click body to select · drag orbit`
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
        onPointerMissed={() => onClearSelection?.()}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[240, -160, 320]} intensity={1.1} />
        <directionalLight position={[-180, 120, 80]} intensity={0.4} />
        <Grid />
        <DatumPlanes />
        {mesh ? (
          <>
            <SelectableBody
              mesh={mesh}
              selected={Boolean(selected)}
              onSelect={() => onSelectBody?.()}
            />
            <FitCamera mesh={mesh} fitNonce={fitNonce} />
          </>
        ) : null}
        <OrbitControls enabled />
      </Canvas>
    </div>
  );
}
