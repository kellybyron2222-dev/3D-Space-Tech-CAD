# Product overview

**Working name:** SpaceForge (Space Tech 3D on GitHub)

**One-liner:** Browser **space CAD** — design CubeSat and structure geometry with parametric features, produce drawings, export STEP; optional L0 analysis overlays.

## Product shape

SpaceForge is a **CAD application** first:

- Dominant 3D viewport
- Feature tree / history (sketch → extrude / cut / fillet)
- Context toolbars and property dialogs
- Drawing tab for 2D views
- Space-domain templates (1U / 3U chassis, rails)

**Analysis** (mass, power, CDS scorecard, VCRM) is a **secondary overlay** — not the home screen.

## In scope (CAD-first MVP)

- Part Studio: feature history, rebuild via OCCT / Replicad Web Worker
- Sketch → extrude / cut (constraints lite)
- Face / edge / body selection
- Drawing views (ortho) + dimension lite
- STEP import / export (B-rep truth; mesh display only)
- CubeSat / space templates
- Analysis overlay: L0 mass / CDS (demoted UI)

## Out of MVP

- CATIA / NX / SolidWorks parity
- Custom geometry kernel
- Full ASME / GD&T production drafting
- LLM agent as primary authoring (post-MVP)
- Orbital compute / SBSP / lunar modules
- Multiplayer CRDT, FEM thermal
- ITAR-certified SaaS claims

## Principles

1. B-rep (OpenCascade) is geometry truth; mesh is display only
2. Geometry interaction is the product; forms support features, not the reverse
3. Honest fidelity labels on any analysis (`L0` / later `L1` / `L2`)
4. Not flight-qualified — export to professional CAD/CAE for flight work

## Roadmap (summary)

CAD shell + features → sketch → drafting → space templates → analysis overlay polish → thin AI agent → broader space domains
