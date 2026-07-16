import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyAssemblyMates,
  createBracketDemo,
  createDemoAssembly,
  newFeatureId,
  serializeAssemblyDocument,
  type AssemblyDocument,
  type FeatureDocument,
} from "@spacetech/sfd-lang";
import { saveAs } from "file-saver";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { mergeMassProps, mergeMeshes, translateMesh } from "../cad/assemblyMesh";
import { getCadApi } from "../cad/client";
import { Viewport } from "./Viewport";

function assemblyFromPart(part: FeatureDocument): AssemblyDocument {
  const post: FeatureDocument = {
    version: 1,
    name: "Post",
    rollbackIndex: null,
    features: [
      {
        id: "p1",
        name: "Post",
        kind: "box",
        widthMm: 12,
        depthMm: 12,
        heightMm: 40,
      },
    ],
  };
  return {
    version: 1,
    name: `${part.name} Assembly`,
    instances: [
      {
        id: "i-base",
        name: part.name,
        part: structuredClone(part),
        xMm: 0,
        yMm: 0,
        zMm: 0,
      },
      {
        id: "i-post",
        name: "Post",
        part: post,
        xMm: 25,
        yMm: 0,
        zMm: 8,
      },
    ],
    mates: [
      {
        id: "m1",
        kind: "distance",
        partA: "i-base",
        partB: "i-post",
        distanceMm: 8,
      },
    ],
  };
}

function partStudioKey(part: FeatureDocument): string {
  return `${part.name}|${part.features.length}`;
}

/** Assembly lite — place instances; mates drive relative placement. */
export function AssemblyPanel({ partDoc }: { partDoc?: FeatureDocument }) {
  const seed = useMemo(
    () => (partDoc ? assemblyFromPart(partDoc) : createDemoAssembly()),
    // only reseeds when part name/feature count changes intentionally via button
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [asm, setAsm] = useState<AssemblyDocument>(seed);
  const [syncedPartKey, setSyncedPartKey] = useState<string | null>(
    partDoc ? partStudioKey(partDoc) : null,
  );
  const [mesh, setMesh] = useState<TessellationResult | null>(null);
  const [status, setStatus] = useState("Building assembly…");
  const [fitNonce, setFitNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const partStudioStale =
    partDoc != null &&
    syncedPartKey != null &&
    partStudioKey(partDoc) !== syncedPartKey;

  const rebuild = useCallback(async (doc: AssemblyDocument) => {
    setStatus("Rebuilding assembly…");
    setError(null);
    try {
      const cad = getCadApi();
      await cad.ready();
      const placed = applyAssemblyMates(doc);
      setAsm((prev) => {
        const unchanged =
          prev.instances.length === placed.instances.length &&
          prev.instances.every(
            (inst, i) => {
              const next = placed.instances[i]!;
              return (
                inst.xMm === next.xMm &&
                inst.yMm === next.yMm &&
                inst.zMm === next.zMm
              );
            },
          );
        return unchanged ? prev : placed;
      });

      const results = await Promise.all(
        placed.instances.map((inst) =>
          cad.rebuildFeatures(structuredClone(inst.part)),
        ),
      );
      const meshes = placed.instances.map((inst, i) =>
        translateMesh(results[i]!.mesh, inst.xMm, inst.yMm, inst.zMm),
      );
      const mergedMass = mergeMassProps(results.map((r) => r.mass));
      setMesh(mergeMeshes(meshes));
      setFitNonce((n) => n + 1);
      setStatus(
        `${doc.instances.length} instances · ${doc.mates.length} mates · ${mergedMass.massKg.toFixed(3)} kg (Al L0)`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly failed");
      setStatus("Assembly rebuild failed");
    }
  }, []);

  useEffect(() => {
    void rebuild(asm);
  }, [asm, rebuild]);

  function updateOffset(id: string, axis: "xMm" | "yMm" | "zMm", value: number) {
    setAsm((prev) => ({
      ...prev,
      instances: prev.instances.map((inst) =>
        inst.id === id ? { ...inst, [axis]: value } : inst,
      ),
    }));
  }

  function updateMateDistance(id: string, distanceMm: number) {
    setAsm((prev) => ({
      ...prev,
      mates: prev.mates.map((m) =>
        m.id === id ? { ...m, distanceMm } : m,
      ),
    }));
  }

  function syncFromPart() {
    if (!partDoc) {
      setAsm(createDemoAssembly());
      setSyncedPartKey(null);
      return;
    }
    setAsm(assemblyFromPart(partDoc));
    setSyncedPartKey(partStudioKey(partDoc));
  }

  function addCoincidentMate() {
    setAsm((prev) => {
      if (prev.instances.length < 2) return prev;
      const partA = prev.instances[0]!.id;
      const partB = prev.instances[1]!.id;
      return {
        ...prev,
        mates: [
          ...prev.mates,
          {
            id: newFeatureId("mate"),
            kind: "coincident",
            partA,
            partB,
          },
        ],
      };
    });
  }

  function addDistanceMate() {
    setAsm((prev) => {
      if (prev.instances.length < 2) return prev;
      const partA = prev.instances[0]!.id;
      const partB = prev.instances[1]!.id;
      return {
        ...prev,
        mates: [
          ...prev.mates,
          {
            id: newFeatureId("mate"),
            kind: "distance",
            partA,
            partB,
            distanceMm: 10,
          },
        ],
      };
    });
  }

  function addPostInstance() {
    setAsm((prev) => ({
      ...prev,
      instances: [
        ...prev.instances,
        {
          id: newFeatureId("inst"),
          name: `Post ${prev.instances.length}`,
          part: {
            version: 1,
            name: "Post",
            rollbackIndex: null,
            features: [
              {
                id: "p1",
                name: "Post",
                kind: "box",
                widthMm: 10,
                depthMm: 10,
                heightMm: 30,
              },
            ],
          },
          xMm: 10 * prev.instances.length,
          yMm: 0,
          zMm: 8,
        },
      ],
    }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {partStudioStale ? (
        <div
          className="ux-banner"
          role="status"
          style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", flexShrink: 0 }}
        >
          Part Studio updated — click Use Part Studio to refresh
        </div>
      ) : null}
      <div className="assembly-layout" style={{ flex: 1, minHeight: 0 }}>
      <aside className="feature-tree">
        <div className="tree-head">
          <span>Instances</span>
          <button type="button" className="linkish" onClick={syncFromPart}>
            {partDoc ? "Use Part Studio" : "Reset demo"}
          </button>
        </div>
        <ul>
          {asm.instances.map((inst) => (
            <li key={inst.id} className="asm-instance">
              <strong>{inst.name}</strong>
              <label className="field">
                <span>X</span>
                <input
                  type="number"
                  value={inst.xMm}
                  onChange={(e) =>
                    updateOffset(inst.id, "xMm", Number(e.target.value))
                  }
                />
              </label>
              <label className="field">
                <span>Y</span>
                <input
                  type="number"
                  value={inst.yMm}
                  onChange={(e) =>
                    updateOffset(inst.id, "yMm", Number(e.target.value))
                  }
                />
              </label>
              <label className="field">
                <span>Z</span>
                <input
                  type="number"
                  value={inst.zMm}
                  onChange={(e) =>
                    updateOffset(inst.id, "zMm", Number(e.target.value))
                  }
                />
              </label>
            </li>
          ))}
        </ul>
        <button type="button" className="secondary" onClick={addPostInstance}>
          Add post
        </button>
        <div className="tree-head" style={{ marginTop: "0.75rem" }}>
          <span>Mates</span>
        </div>
        <ul>
          {asm.mates.map((m) => (
            <li key={m.id} className="asm-instance">
              <strong>
                {m.kind} · {m.partA} → {m.partB}
              </strong>
              {m.kind === "distance" ? (
                <label className="field">
                  <span>Dist</span>
                  <input
                    type="number"
                    value={m.distanceMm ?? 0}
                    onChange={(e) =>
                      updateMateDistance(m.id, Number(e.target.value))
                    }
                  />
                </label>
              ) : null}
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.35rem" }}>
          <button
            type="button"
            className="secondary"
            disabled={asm.instances.length < 2}
            onClick={addCoincidentMate}
          >
            Add coincident mate
          </button>
          <button
            type="button"
            className="secondary"
            disabled={asm.instances.length < 2}
            onClick={addDistanceMate}
          >
            Add distance mate
          </button>
        </div>
        <button
          type="button"
          className="secondary"
          style={{ marginTop: "0.5rem" }}
          onClick={() => {
            saveAs(
              new Blob([serializeAssemblyDocument(asm)], {
                type: "application/json",
              }),
              `${asm.name.replace(/\s+/g, "_")}.asm.json`,
            );
          }}
        >
          Save assembly
        </button>
        <p className="tree-hint">
          Coincident mates align partB to partA XYZ. Distance mates set partB Z
          = partA Z + dist. Use Part Studio pulls current part as base (
          {partDoc?.name ?? createBracketDemo().name}).
        </p>
        {error ? <p className="error-text">{error}</p> : null}
      </aside>
      <section className="cad-viewport-wrap">
        <Viewport
          mesh={mesh}
          status={status}
          fitNonce={fitNonce}
          onFit={() => setFitNonce((n) => n + 1)}
        />
      </section>
    </div>
    </div>
  );
}
