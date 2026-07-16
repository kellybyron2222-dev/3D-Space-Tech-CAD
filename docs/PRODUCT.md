# Product overview

**Working name:** SpaceForge (Space Tech 3D on GitHub)

**One-liner:** Open-source browser MCAD for space hardware education and Phase A — Onshape-class core modeling + drawings, CubeSat templates, soft analysis overlays, AI that edits the feature graph (solvers authoritative).

## Status honesty

Until **table-stakes** ship (sketch, full feature set, selection, assemblies, drawings, STEP), treat the app as a **CAD preview**, not a peer to SolidWorks / Onshape / FreeCAD.

Master plan: `.cursor/plans/spacetech_mvp_table_stakes.plan.md` (and competitive canvas).

## Necessary but not sufficient (MVP gate)

Industry SMEs will not call this “real CAD” without:

1. Constrained sketch (line/rect/circle + H/V/coincident/parallel + dims)
2. Extrude / Cut / Revolve / Fillet / Chamfer
3. Feature tree edit + rollback + undo
4. Face / edge / body selection + measure
5. Named parameters
6. Assembly lite (mates)
7. Associative 2D drawings (ortho, dims, title block, PDF/SVG)
8. STEP import/export (FreeCAD-proven) + STL
9. Mass / volume / CG (L0)
10. Save / open / templates / autosave

**Exit test:** wall + hole + fillet → 2-part assembly → dimensioned drawing → STEP opens in FreeCAD — without using Analysis.

## Differentiator wedge (why us vs desktop)

What ~100 simulated SME interviews said desktop tools under-serve:

- Free + browser + self-host (no seat/VPN tax)
- Shareable project URL
- Git-diffable feature/SFD source
- AI → feature patches with rebuild veto (not chat-as-mesh)
- CubeSat / space templates + CDS soft overlay
- Edit/heal imported STEP without remaster
- Runs on mediocre student laptops

## Explicitly out of MVP

CATIA/NX/Creo parity, full GD&T, CAM, FEM, multiplayer CRDT, SBSP/lunar, flight-qualification claims, analysis-first UI.

## Principles

1. B-rep (OpenCascade) is geometry truth; mesh is display only
2. Table-stakes before differentiators
3. Geometry interaction is the product; Analysis is an overlay
4. Deterministic solvers / kernel rebuild are authority over AI
5. Not flight-qualified

## Roadmap

Phase A table-stakes core → Phase B assembly + drawings → Phase C space wedge + AI → Phase D ship → post-MVP depth
