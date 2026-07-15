import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { BufferGeometry, Color, DoubleSide } from "three";
import {
  syncFaces,
  syncLines,
  syncLinesFromFaces,
  type ReplicadMeshedEdges,
  type ReplicadMeshedFaces,
} from "replicad-threejs-helper";
import type { TessellationResult } from "@spacetech/kernel-bridge";

export function ReplicadMesh({
  faces,
  edges,
  color = "#5f7d95",
}: TessellationResult & { color?: string }) {
  const { invalidate } = useThree();

  const { body, lines } = useMemo(() => {
    const nextBody = new BufferGeometry();
    const nextLines = new BufferGeometry();
    if (faces?.vertices?.length) {
      syncFaces(nextBody, faces as ReplicadMeshedFaces);
      if (edges?.lines?.length) {
        syncLines(nextLines, edges as ReplicadMeshedEdges);
      } else {
        syncLinesFromFaces(nextLines, nextBody);
      }
    }
    return { body: nextBody, lines: nextLines };
  }, [faces, edges]);

  useEffect(() => {
    invalidate();
    return () => {
      body.dispose();
      lines.dispose();
      invalidate();
    };
  }, [body, lines, invalidate]);

  const triCount = faces?.triangles?.length ? faces.triangles.length / 3 : 0;
  if (triCount === 0) return null;

  return (
    <group>
      <mesh geometry={body}>
        <meshStandardMaterial
          color={new Color(color)}
          metalness={0.2}
          roughness={0.4}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={1}
        />
      </mesh>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#15202b" />
      </lineSegments>
    </group>
  );
}
