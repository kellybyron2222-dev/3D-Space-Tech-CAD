import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import * as THREE from "three";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { ReplicadMesh } from "./ReplicadMesh";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

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
      {!mesh ? (
        <div className="viewport-overlay">{status}</div>
      ) : null}
      <Canvas
        frameloop="demand"
        dpr={dpr}
        camera={{ position: [220, -220, 180], fov: 35, near: 0.1, far: 5000 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#f4f1ea"]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[200, -120, 260]} intensity={0.9} />
        <Suspense fallback={null}>
          {mesh ? (
            <Center>
              <ReplicadMesh faces={mesh.faces} edges={mesh.edges} />
            </Center>
          ) : null}
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
