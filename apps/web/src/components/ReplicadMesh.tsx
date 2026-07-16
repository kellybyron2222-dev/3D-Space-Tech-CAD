import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute } from "three";
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
  highlightFaceIndex = null,
}: TessellationResult & {
  color?: string;
  highlightFaceIndex?: number | null;
}) {
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

      // Per-vertex tint for selected face group
      const groups = faces.faceGroups ?? [];
      if (
        highlightFaceIndex != null &&
        groups[highlightFaceIndex] &&
        nextBody.getAttribute("position")
      ) {
        const pos = nextBody.getAttribute("position");
        const colors = new Float32Array(pos.count * 3);
        const base = new Color(color);
        const hot = new Color("#e8a05a");
        for (let i = 0; i < pos.count; i++) {
          colors[i * 3] = base.r;
          colors[i * 3 + 1] = base.g;
          colors[i * 3 + 2] = base.b;
        }
        const g = groups[highlightFaceIndex]!;
        // faceGroups use triangle index ranges in replicad
        const startTri = g.start ?? 0;
        const countTri = g.count ?? 0;
        const index = nextBody.getIndex();
        if (index) {
          for (let t = startTri; t < startTri + countTri; t++) {
            for (let k = 0; k < 3; k++) {
              const vi = index.getX(t * 3 + k);
              colors[vi * 3] = hot.r;
              colors[vi * 3 + 1] = hot.g;
              colors[vi * 3 + 2] = hot.b;
            }
          }
        }
        nextBody.setAttribute("color", new Float32BufferAttribute(colors, 3));
      }
    }
    return { body: nextBody, lines: nextLines };
  }, [faces, edges, color, highlightFaceIndex]);

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

  const useVertexColors =
    highlightFaceIndex != null && Boolean(faces.faceGroups?.length);

  return (
    <group>
      <mesh geometry={body}>
        <meshStandardMaterial
          color={useVertexColors ? "#ffffff" : new Color(color)}
          vertexColors={useVertexColors}
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
