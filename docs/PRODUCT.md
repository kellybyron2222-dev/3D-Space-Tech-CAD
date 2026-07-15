# Product overview

**Working name:** SpaceForge (Space Tech 3D on GitHub)

**One-liner:** Open-source CubeSat Phase A systems workbook with real geometry and CDS-aware budgets — AI optional, physics authoritative, university-first.

## MVP (in scope)

- Browser app + parametric **Reference-3U** template (LibreCube-tagged)
- Default open-hardware **OSCubeSatStruct Mk5** STEP visual
- **OCCT / Replicad Web Worker** (B-rep truth, mesh display)
- Mass / CG and **mode-based** power budgets + **L0 thermal** + PV generation from panel area
- CDS-style scorecard (envelope, mass, CG, deployer keep-out, soft power)
- **VCRM-lite** + **ICD stubs** + assumption registry
- Export STEP (parametric), **BOM CSV**, **CDR Markdown**, project JSON
- FreeCAD STEP roundtrip; PWA (next)
- Physics-informed + soft-constrained (deterministic solvers are authority)

## Out of MVP

- LLM agent (post-MVP)
- Orbital compute / SBSP / lunar modules
- Multiplayer CRDT, FEM thermal, ASME production drafting
- Custom geometry kernel or mesh-as-truth
- ITAR-certified SaaS claims

## Principles

1. B-rep (OpenCascade) is geometry truth; mesh is display only
2. Budgets stay bound to geometry parameters (panel area → PV watts)
3. Honest fidelity labels (`L0` / later `L1` / `L2`)
4. Not flight-qualified — engineers refine and export to professional CAD/CAE

## Roadmap (summary)

MVP → thin AI agent → Orekit/org catalogs → orbital compute kit → FEM / SBSP / lunar
