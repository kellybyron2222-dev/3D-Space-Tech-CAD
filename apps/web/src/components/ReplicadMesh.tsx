import { useEffect, useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { BufferGeometry } from "three";
import {
  syncFaces,
  syncLines,
  syncLinesFromFaces,
  type ReplicadMeshedEdges,
  type ReplicadMeshedFaces,
} from "replicad-threejs-helper";
import type { TessellationResult } from "@spacetech/kernel-bridge";

export function ReplicadMesh({ faces, edges }: TessellationResult) {
  const { invalidate } = useThree();
  const body = useRef(new BufferGeometry());
  const lines = useRef(new BufferGeometry());

  useLayoutEffect(() => {
    if (faces) syncFaces(body.current, faces as ReplicadMeshedFaces);
    if (edges) syncLines(lines.current, edges as ReplicadMeshedEdges);
    else if (faces) syncLinesFromFaces(lines.current, body.current);
    invalidate();
  }, [faces, edges, invalidate]);

  useEffect(
    () => () => {
      body.current.dispose();
      lines.current.dispose();
      invalidate();
    },
    [invalidate],
  );

  return (
    <group>
      <mesh geometry={body.current}>
        <meshStandardMaterial
          color="#7a8fa3"
          metalness={0.25}
          roughness={0.45}
          polygonOffset
          polygonOffsetFactor={1}
        />
      </mesh>
      <lineSegments geometry={lines.current}>
        <lineBasicMaterial color="#1a2330" />
      </lineSegments>
    </group>
  );
}
