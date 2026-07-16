# Space Tech 3D (SpaceForge)

Open-source **CubeSat Phase A systems workbook**: parametric 3D geometry, mass/power budgets, and CDS-aware checks — built for university teams first, extensible later to broader space infrastructure design.

> **Not flight-qualified.** This software helps produce preliminary design packages. It does not certify spacecraft for flight. Always validate with qualified engineers and appropriate analysis tools.

## Status

**MVP-3/6 in progress:** Open **OSCubeSatStruct Mk5** visual + live budgets/CDS, guided Phase A coach, envelope ghost overlay, editable VCRM/ICD, BOM + CDR (Markdown/HTML), project save/load.

Repository: [kellybyron2222-dev/3D-Space-Tech-CAD](https://github.com/kellybyron2222-dev/3D-Space-Tech-CAD)

## Why this exists

University CubeSat teams often juggle spreadsheets + desktop CAD. SpaceForge aims to be a free, browser-hosted front door: tweak parameters, see budgets turn green/red against CubeSat Design Specification style rules, and export a reviewable package into FreeCAD / other CAD tools.

## MVP features

- Parametric **Reference-3U** model (LibreCube-aligned subsystem tags)
- Live **mass / CG**, **mode-based power**, **L0 PV** (panel area → watts), **L0 thermal**
- **CDS scorecard** with citations + traffic-light margins
- **VCRM-lite** + **ICD stubs** + assumption registry
- Export **STEP** (parametric), **BOM CSV**, **CDR Markdown**, project JSON

AI assistance, orbital compute kits, SBSP, and lunar modules are **post-MVP**.

## Quick start

Requirements: Node.js 22+, [pnpm](https://pnpm.io/) 9+

```bash
pnpm install
pnpm build
pnpm --filter @spacetech/web dev
```

Open **http://localhost:5174/** — Design / Budgets / Scorecard / Systems / Export tabs.

API (optional):

```bash
pnpm --filter @spacetech/api dev
```

## Monorepo layout

```text
apps/web             Browser UI (React)
apps/api             Project save/load API
packages/sfd-lang    SpaceForge Design language (parametric source of truth)
packages/budgets     Mass / power / PV / thermal ledgers
packages/rules-cds   CDS-style checkers
packages/systems     VCRM-lite, ICD stubs, assumptions
packages/kernel-bridge  OpenCascade / Replicad worker bridge
assets/reference     Bundled open CubeSat STEP + attribution
```

## University path

See [docs/UNIVERSITY.md](docs/UNIVERSITY.md) and [docs/PRODUCT.md](docs/PRODUCT.md).

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

OpenCascade-based dependencies may carry LGPL obligations; attribution is in `NOTICE` and `assets/reference/ATTRIBUTION.md`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) (DCO sign-off required). Read [EXPORT_CONTROL.md](EXPORT_CONTROL.md) and [SECURITY.md](SECURITY.md) before submitting sensitive material.
