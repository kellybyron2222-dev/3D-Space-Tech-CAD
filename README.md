# Space Tech 3D (SpaceForge)

Open-source **browser space CAD**: parametric Part Studio (multi-entity sketches, extrude/cut/revolve/fillet/chamfer, assemblies lite, drawing SVG, STEP/STL, mass props) — CubeSat templates and optional L0 analysis overlays.

> **Preview until table-stakes ship.** Sketch place + editor, H/V/dim solve lite, core feature ops, STEP/STL I/O, mass props, and an exit-test coach are in; full constrained sketch and true mates are not. Not parity with SolidWorks / Onshape / FreeCAD. See [docs/PRODUCT.md](docs/PRODUCT.md).

> **Not flight-qualified.** Educational / Phase A use. Validate with qualified engineers and professional CAD/CAE before flight.

## MVP outlook

**Gate (necessary, not sufficient):** constrained sketch, extrude/cut/revolve/fillet/chamfer, face/edge select, feature tree + undo, params, assembly mates lite, associative drawings, STEP I/O, mass props, save/templates.

**Wedge (why pick us):** free + web + self-host, share links, git-diffable design source, space templates + CDS overlay, AI feature-graph edits with rebuild veto.

Full plan: competitive SME synthesis → table-stakes phases in the Cursor plan `MVP CAD Table Stakes`.

## Quick start

Requirements: Node.js 22+, [pnpm](https://pnpm.io/) 9+

```bash
pnpm install
pnpm build
pnpm --filter @spacetech/web dev
```

Open **http://localhost:5174/**

## Monorepo

```text
apps/web             CAD UI + OCCT worker
apps/api             Project API
packages/sfd-lang    Feature documents + templates
packages/budgets     Analysis overlay
packages/rules-cds   CDS-style checkers
packages/systems     VCRM / ICD stubs (overlay)
packages/kernel-bridge
assets/reference     Open CubeSat STEP
```

## License

Apache-2.0 — [LICENSE](LICENSE), [NOTICE](NOTICE).

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) (DCO). Read [EXPORT_CONTROL.md](EXPORT_CONTROL.md) and [SECURITY.md](SECURITY.md).
