# Space Tech 3D (SpaceForge)

Open-source **browser space CAD**: parametric 3D modeling (feature history, viewport-first), drafting, and STEP export — with CubeSat/space templates and optional L0 analysis overlays.

> **Not flight-qualified.** Preliminary design and education. Validate with qualified engineers and professional CAD/CAE before flight.

## Status

**CAD-first rebuild in progress.** Part Studio shell (feature tree, toolbar, dominant viewport), box/extrude features via OCCT Web Worker, Analysis overlay for budgets/CDS. Full sketch editor and production drawings are next.

Repository: [kellybyron2222-dev/3D-Space-Tech-CAD](https://github.com/kellybyron2222-dev/3D-Space-Tech-CAD)

## Quick start

Requirements: Node.js 22+, [pnpm](https://pnpm.io/) 9+

```bash
pnpm install
pnpm build
pnpm --filter @spacetech/web dev
```

Open **http://localhost:5174/**

## Monorepo layout

```text
apps/web             CAD UI (React) + OCCT worker
apps/api             Project API
packages/sfd-lang    Design document helpers / templates
packages/budgets     Analysis overlay — mass / power / thermal
packages/rules-cds   Analysis overlay — CDS-style checkers
packages/systems     Analysis overlay — VCRM / ICD stubs
packages/kernel-bridge  Tessellation types
assets/reference     Open CubeSat STEP + attribution
```

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) (DCO sign-off required). Read [EXPORT_CONTROL.md](EXPORT_CONTROL.md) and [SECURITY.md](SECURITY.md).

## Product notes

See [docs/PRODUCT.md](docs/PRODUCT.md).
