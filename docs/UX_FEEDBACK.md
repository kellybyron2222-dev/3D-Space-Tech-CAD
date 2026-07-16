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

### Loop A (2h session) — Sketch entities
- Multi-entity sketch model (line/rect/circle) + SketchEditor panel
- Viewport ghost renders all entities
- Extrude/Cut still driven via syncSketchProfileFromEntities

**Sim:** “Finally can edit more than one profile number — still numeric, not click-draw, but feels like a sketcher shell.”

### Loop B — Constraint solve lite
- `solveSketch` / `applyDrivingDimension`: H/V on lines, coincident snap, driving width/height/dia
- Wired through SketchEditor onChange

**Sim:** “Changing width dim resizes rect; H/V actually flatten lines. Want click-to-place next.”

### Loop C — Edge selection
- Shift+click cycles mesh edges; highlight + length measure
- Fillet/Chamfer store edgeIndices; Bind to feature (kernel still global fillet fallback)

**Sim:** “Edge highlight is real CAD muscle memory. Binding edges without kernel filter yet is honest but incomplete.”

### Loop D — Exit path
- ExitCoach checklist banner; Drawing title block + hole callout; smoke:step script

**Sim:** “Coach makes the SME exit test obvious. Drawing still bbox — good enough for Phase A demo.”

### Still open (next sessions)
- True OCCT edge-filtered fillet
- True silhouette drawing projection
- Full geometric mate solver
- AI feature patches

### Loop E — Click-place + kernel fillet hints
- Viewport click/drag place for rect/circle/line when sketch selected
- Driving dim W/H/Dia + H/V toggles in SketchEditor
- Fillet uses edgeIndices as EdgeFinder plane/direction hints with global fallback

**Sim feedback:** “Click-place on the plane finally feels like sketching; fillet hints are honest — still global fallback but less random.”

### Loop F — Multi-entity extrude fuse
- Extrude/Cut on sketches with multiple entities: each entity → prism, then `fuseSolids` (extrude) or per-entity cut
- Driving dims still target first rect/circle via `applyDrivingDimension` → `solveSketch`
- Selecting non-sketch feature clears sketch place mode

**Sim feedback:** "Two rects in one sketch extrude as one fused solid — finally multi-profile without duplicate sketches. Dims only move the first shape — need per-entity dims next."

### 2h wall-clock session wrap (Loops A–F+)
- Multi-entity sketch + place + solve
- Edge select
- Exit coach
- Multi-entity extrude
- Assembly mates
- Material mass
- importBody markers
- Shortcuts
- CI smoke
- Driving params depth/extrude

**Sim feedback:** "Feels like a real CAD preview now — sketcher still thin vs Onshape but the exit path is teachable."

**Still open:** true B-rep edge fillet map, silhouette drawings, full mates, AI patches.

### Loop G — Tool-first placement + handles
- Toolbar picks Cut/Hole/Fillet; tool stays active until placed
- Click solid (or Enter) to place; select feature → drag colored handles
- Parameters/Properties for numeric edits; GettingStarted reset to v2 key

**Sim feedback:** "Tool-then-click matches CAD muscle memory. Handles make Bracket-Demo editable without opening every param first."

### Loop H — Tool modes, handles, wall sync, crosshair
- Mirror + Pattern join toolbar tool modes (stay active until placed)
- Viewport crosshair + HUD hint when a placement tool is active
- Drag handles scale up (1.3×) while dragging; rebuild deferred until release
- Base height handle keeps `wall` named parameter in sync on Bracket-Demo

**Sim feedback:** "Crosshair + hint makes tool mode obvious. Handle grow on drag feels tactile. Wall param tracking height handle closes the Bracket-Demo loop."

### Loop I — Click-where placement + real picking
- Hole/Cut tools place at the clicked world XY (0.5 mm snap); through-depth from `wall` / bbox
- Face pick uses raycast triangle → face group (no more cycling faces on every click)
- Shift+click picks nearest edge to the hit point (fillet/chamfer)
- Esc stages: cancel tool → cancel sketch place → clear selection
- Shortcuts: H/C/F/E; HUD shows live dims while dragging handles
- Revolve handles enabled in viewport

**Sim feedback:** "Click where I want the hole — finally. Face highlight matches what I clicked. Esc doesn’t wipe the whole selection when I only meant to drop the tool."
