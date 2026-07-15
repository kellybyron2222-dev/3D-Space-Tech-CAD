import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { ReplicadMesh } from "./ReplicadMesh";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

function OrbitControls() {
  const { camera, gl, invalidate } = useThree();
  const controls = useMemo(
    () => new ThreeOrbitControls(camera, gl.domElement),
    [camera, gl],
  );

  useEffect(() => {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    const onChange = () => invalidate();
    controls.addEventListener("change", onChange);
    return () => {
      controls.removeEventListener("change", onChange);
      controls.dispose();
    };
  }, [controls, invalidate]);

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

function FitCamera({ mesh }: { mesh: TessellationResult }) {
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
  }, [mesh, camera, invalidate]);

  return null;
}

function Grid() {
  const helper = useMemo(() => {
    const g = new THREE.GridHelper(400, 20, "#b9b3a6", "#d9d3c6");
    g.rotation.x = Math.PI / 2;
    return g;
  }, []);
  return <primitive object={helper} />;
}

export function Viewport({
  mesh,
  status,
}: {
  mesh: TessellationResult | null;
  status: string;
}) {
  const dpr = Math.min(
    typeof window !== "undefined" ? window.devicePixelRatio : 1,
    2,
  );
  const triCount = mesh?.faces.triangles.length
    ? Math.round(mesh.faces.triangles.length / 3)
    : 0;

  return (
    <div className="viewport-canvas">
      <div className="viewport-hud">
        {mesh ? `${triCount.toLocaleString()} triangles · drag to orbit` : status}
      </div>
      {!mesh ? <div className="viewport-overlay">{status}</div> : null}
      <Canvas
        frameloop="always"
        dpr={dpr}
        camera={{ position: [280, -280, 200], fov: 35, near: 0.1, far: 8000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#ebe6dc");
        }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[240, -160, 320]} intensity={1.05} />
        <directionalLight position={[-180, 120, 80]} intensity={0.35} />
        <Grid />
        {mesh ? (
          <>
            <ReplicadMesh faces={mesh.faces} edges={mesh.edges} />
            <FitCamera mesh={mesh} />
          </>
        ) : null}
        <OrbitControls />
      </Canvas>
    </div>
  );
}
