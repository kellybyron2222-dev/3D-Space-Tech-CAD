# Product overview

**Working name:** SpaceForge (Space Tech 3D on GitHub)

**One-liner:** Open-source CubeSat Phase A systems workbook with real geometry and CDS-aware budgets — AI optional, physics authoritative, university-first.

## MVP (in scope)

- Browser app + parametric Reference-3U template
- Mass / CG and **mode-based** power budgets + L0 thermal flags
- CDS-style scorecard (envelope, mass, deployer keep-outs)
- VCRM-lite + ICD stubs + assumption registry
- Export STEP + CDR PDF + BOM CSV
- FreeCAD STEP roundtrip; university curriculum notes
- Physics-informed + soft-constrained (deterministic solvers are authority)

## Out of MVP

- LLM agent (post-MVP)
- Orbital compute / SBSP / lunar modules
- Multiplayer CRDT, FEM thermal, ASME production drafting
- Custom geometry kernel or mesh-as-truth
- ITAR-certified SaaS claims

## Principles

1. B-rep (OpenCascade) is geometry truth; mesh is display only
2. Budgets stay bound to geometry parameters
3. Honest fidelity labels (`L0` / later `L1` / `L2`)
4. Not flight-qualified — engineers refine and export to professional CAD/CAE

## Roadmap (summary)

MVP → thin AI agent → Orekit/org catalogs → orbital compute kit → FEM / SBSP / lunar
