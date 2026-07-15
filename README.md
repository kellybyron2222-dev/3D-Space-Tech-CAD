# Space Tech 3D (SpaceForge)

Open-source **CubeSat Phase A systems workbook**: parametric 3D geometry, mass/power budgets, and CDS-aware checks — built for university teams first, extensible later to broader space infrastructure design.

> **Not flight-qualified.** This software helps produce preliminary design packages. It does not certify spacecraft for flight. Always validate with qualified engineers and appropriate analysis tools.

## Status

**MVP-2 in progress:** Reference-3U parametric chassis in an OpenCascade (Replicad) Web Worker, three.js viewport, STEP/STL export, live L0 budgets + CDS scorecard.

Repository: [kellybyron2222-dev/3D-Space-Tech-CAD](https://github.com/kellybyron2222-dev/3D-Space-Tech-CAD)

## Why this exists

University CubeSat teams often juggle spreadsheets + desktop CAD. SpaceForge aims to be a free, browser-hosted front door: tweak parameters, see budgets turn green/red against CubeSat Design Specification style rules, and export a reviewable package into FreeCAD / other CAD tools.

## MVP features (building now)

- Parametric **Reference-3U** model (LibreCube-aligned subsystem tags)
- Live **mass / CG** and **mode-based power** budgets (L0 thermal flags)
- **CDS scorecard** with citations
- VCRM-lite + ICD stubs + assumption registry
- Export **STEP**, **CDR PDF**, **BOM CSV**

AI assistance, orbital compute kits, SBSP, and lunar modules are **post-MVP**.

## Quick start

Requirements: Node.js 22+, [pnpm](https://pnpm.io/) 9+

```bash
pnpm install
pnpm build
pnpm --filter @spacetech/web dev
```

API (optional, when running full stack):

```bash
pnpm --filter @spacetech/api dev
```

## Monorepo layout

```text
apps/web          Browser UI (React)
apps/api          Project save/load API
packages/sfd-lang SpaceForge Design language (parametric source of truth)
packages/budgets  Mass / power / thermal ledgers
packages/rules-cds  CDS-style checkers
packages/kernel-bridge  OpenCascade / Replicad worker bridge (MVP-2+)
```

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

OpenCascade-based dependencies (when added) may carry LGPL obligations; attribution will be maintained in `NOTICE`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) (DCO sign-off required). Read [EXPORT_CONTROL.md](EXPORT_CONTROL.md) and [SECURITY.md](SECURITY.md) before submitting sensitive material.

## Product notes

See [docs/PRODUCT.md](docs/PRODUCT.md).
