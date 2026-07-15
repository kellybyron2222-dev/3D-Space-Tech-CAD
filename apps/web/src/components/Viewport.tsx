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

function FittedMesh({ mesh }: { mesh: TessellationResult }) {
  return (
    <group position={[0, 0, 0]}>
      <ReplicadMesh faces={mesh.faces} edges={mesh.edges} />
    </group>
  );
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

  return (
    <div className="viewport-canvas">
      {!mesh ? <div className="viewport-overlay">{status}</div> : null}
      <Canvas
        frameloop="demand"
        dpr={dpr}
        camera={{ position: [280, -280, 200], fov: 35, near: 0.1, far: 5000 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#f4f1ea"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[200, -120, 260]} intensity={0.95} />
        {mesh ? <FittedMesh mesh={mesh} /> : null}
        <OrbitControls />
      </Canvas>
    </div>
  );
}
