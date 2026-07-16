# UX design-loop notes

## Archived: workbook-first UX

Treated as wrong product shape. Analysis lives under **Analysis** tab.

## 2026-07-16 wall-clock MVP sprint (loops)

### Loop 1 — Table-stakes core
- Sketch / Extrude / Box / Cut / Hole / Revolve / Fillet / Chamfer / Mirror
- Feature tree + rollback + Ctrl+Z undo/redo
- Bracket-Demo + 3U templates; Save/Open `.sfd.json`; STEP export
- Mass/volume/CG L0 from OCCT volume
- Assembly lite + Drawing bbox views

**Sim feedback:** “Still not constrained sketch, but finally feels like CAD tools exist.”

### Loop 2 — Visibility & selection
- Sketch ghost in viewport when sketch selected
- Click body cycles face groups (highlight)
- Named parameters (`wall`, `holeDia`) drive features
- Drawing SVG export

**Sim feedback:** “Ghost sketch helps; face cycle is crude but better than body-only; want real constraint solver next.”

### Loop 3 — Persistence & I/O
- localStorage autosave; URL `#sfd=` share links
- Export STL + STEP; Drawing SVG
- Named params via `applyParameters` (wall/holeDia/u/height)
- Cut inherits latest sketch; revolve uses OCCT sketch.revolve
- Assembly: Use Part Studio + editable distance mates + save `.asm.json`

**Sim feedback:** “Autosave + Share makes it feel like a product. Assembly still crude but mates do something. Sketch constraints are labels only — need a real sketcher.”

### Loop 4 — Pattern + wrap (pre-7:15)
- Linear pattern + feature reorder already in shell
- Drawing SVG exports three ortho views
- All unit tests green; pushed `9f6f9fc` to main

### Still open (next sessions)
- Interactive constrained sketch editor
- Edge-accurate fillet selection
- True silhouette drawing projection
- Full geometric mate solver
- AI feature patches
