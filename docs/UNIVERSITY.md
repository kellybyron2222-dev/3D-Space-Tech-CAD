# University Phase A path

How a student CubeSat team uses Space Tech 3D / SpaceForge for a Phase A package.

## One-sitting workflow

1. Open the app — default visual is the open **OSCubeSatStruct Mk5** 3U structure.
2. Stay on **Design**: set envelope (CDS), panel height (PV), eclipse fraction.
3. Open **Budgets**: edit board masses and nominal watts; watch traffic-light margins.
4. Open **Scorecard**: resolve fail/warn items (envelope, mass, CG, keep-out, soft power).
5. Open **Systems**: fill open items on ICD stubs; mark VCRM evidence as you go.
6. Open **Export**: download **BOM CSV** + **CDR Markdown**; save **project JSON**.

## What replaces Excel

| Spreadsheet habit | Here |
|---|---|
| Mass rollup tab | Budgets → mass + CG |
| Power modes tab | safe / nominal / peak / eclipse + PV margin |
| “Does it fit dispenser?” | CDS scorecard |
| Requirements matrix | VCRM-lite |
| Interface notes | ICD stubs |

## Fidelity honesty

Everything is labeled **L0** unless stated otherwise. Advisors should treat numbers as Phase A estimates, then refine in FreeCAD / professional solvers before PDR.

## Not included yet

Link budget, Orekit eclipse, FEM thermal, multi-user sync, LLM agent. See `docs/PRODUCT.md`.
