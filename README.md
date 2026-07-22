# espectr0

**Auditable seismic spectra and structural calculation tools for Colombia.** A [sism0 labs](https://sism0.dev) project.

`espectr0` is a Spanish-language web application for calculating NSR-10 elastic response spectra, comparing site scenarios, evaluating equivalent-static base shear, and generating a reproducible calculation memoria. The numerical engine is pure and deterministic; the interface consumes its typed results without reimplementing engineering formulas.

> **Status: active alpha.** The NSR-10 spectrum, comparison, base-shear, evidence, and PDF workflows are implemented. Results remain a calculation aid and must be reviewed by a qualified structural engineer; see the [disclaimer](#disclaimer).

## What is available

| Module | Current capability | Status |
|---|---|---|
| **Calculadora** | NSR-10 spectra for 1,123 municipality records, soil profiles A–F, importance groups I–IV, and three hazard levels | Available |
| **Comparador** | Up to six independent scenarios on one chart, with summary metrics and soil-F notices | Available |
| **Cortante basal** | `Ta`, `Cu·Ta`, governing period, `Vs`, vertical `Fx`, story shear, and FHE applicability diagnostics | Available |
| **Memoria PDF** | Client-side calculation memoria generated from the versioned calculation trace | Available from Calculadora |
| **Trazabilidad** | Formula steps, substitutions, dependencies, interpolation witnesses, representative ordinates, and source references | Available |
| **Microzonificación** | City-specific microzonification studies | Planned |
| **CCP-14** | Bridge-code spectra | Planned |

## Spectrum engine

The NSR-10 engine supports:

- **Diseño:** 475-year return period, 5% damping, using `Aa` and `Av`.
- **Seguridad limitada:** 225-year return period, 5% damping, using `Ae`.
- **Umbral de daño:** 31-year return period, 2% damping, using `Ad`.
- Site coefficients `Fa` and `Fv`, including exact, interpolated, and clamped table lookups.
- Importance groups I–IV and the applicable NSR-10 spectrum branches.
- Direct ordinate evaluation with `saAt(T)` as well as sampled chart points.
- An explicit `SiteSpecificStudyRequired` result for soil profile F; the engine never fabricates a spectrum for that profile.

The public API is exposed through [`lib/nsr10/index.ts`](lib/nsr10/index.ts):

```ts
import {
  computeSpectrum,
  saAt,
  approximatePeriod,
  periodCeiling,
  baseShear,
  forceDistribution,
  fheApplicability,
  computeCalculationTrace,
  traceSaAt,
} from "@/lib/nsr10"
```

## Base shear

The `/cortante` workspace composes the spectrum and base-shear APIs into one workflow:

- approximate period from the cited `Ct` and `α` values in Table A.4.2-1;
- analytical-period ceiling from `Cu·Ta`, while using `Ta` directly when no analytical period is supplied;
- base shear `Vs = Sa(T)·g·M` and `Vs/W`;
- vertical force distribution and cumulative story shear;
- editable story weights and heights, including CSV paste;
- explicit A.3.4.2 applicability warnings, including irregularities that require dynamic analysis;
- CSV and ETABS TXT exports.

The current workspace evaluates one horizontal direction and reports elastic/static quantities; it does not apply `R` or `φ` strength reductions.

## Calculation trace and exports

Every successful calculator result can produce a versioned `CalculationTrace` containing:

- calculation context and normalized inputs;
- site-coefficient interpolation details;
- formula, substitution, result, unit, reference, and dependencies for each step;
- branch metadata and representative spectrum points;
- on-demand proofs for individual spectral ordinates.

Available exports include:

- full calculation-trace JSON;
- chart PNG and SVG;
- spectrum CSV;
- two-column ETABS TXT (`T Sa`, without a header);
- a client-side PDF memoria with inputs, provenance, interpolation proofs, equations, spectrum chart, representative checks, and source appendix.

The PDF renderer is loaded lazily only when the export action is used.

## Evidence and reproducibility

Normative values do not enter the engine from memory or web lookups. They are transcribed from the pinned full [NSR-10 Título A PDF](public/nsr10-titulo-a-2017.pdf) and tied to machine-checkable evidence in [`lib/nsr10/evidence/manifest.json`](lib/nsr10/evidence/manifest.json).

The evidence system records source page and normalized PDF regions. Its checker re-extracts text from those regions and verifies the checked-in transcriptions for:

- 1,123 municipality citations from Appendix A-4;
- eight base-shear clause/table citations covering gravity/mass, FHE applicability, period limits, approximate-period coefficients, base shear, force distribution, and dynamic minimum shear.

The `Fa`, `Fv`, importance, and spectrum datasets are separately protected by Zod schemas, deterministic golden tests, and provenance metadata.

Run the reproducibility check with:

```bash
pnpm evidence:check
```

## Architecture

```text
app/                         Next.js App Router routes
components/                  Spanish-language application UI and primitives
lib/nsr10/                   Pure deterministic NSR-10 engine
lib/nsr10/evidence/          Pinned citations, schemas, and evidence tests
lib/chart-export.ts          Dependency-free chart and ETABS export helpers
lib/memoria-pdf*.ts(x)       Trace-driven client-side PDF memoria
scripts/                     Evidence generation and verification
public/nsr10-titulo-a-2017.pdf
```

The core rule is simple: presentation layers render engine output; they do not reconstruct engineering math.

## Stack

- **Next.js 16.2** with the App Router
- **React 19.2** and **TypeScript**
- **Tailwind CSS v4**
- shadcn-style primitives built on **Base UI**
- **Recharts 3** for interactive charts
- **Zod 4** for runtime contracts
- **React-PDF 4** for the lazy-loaded memoria
- **Vitest 4** and GitHub Actions
- **pnpm 11**

## Getting started

Development and CI baseline: Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm evidence:check
pnpm exec next build
```

The protected `main` branch requires the GitHub Actions check **Lint, typecheck, test & build** to pass through a pull request.

## Roadmap

- city-specific microzonification inputs;
- independent X/Y direction workflows for base shear;
- a dedicated memoria project workspace;
- CCP-14 bridge spectra;
- a final open-source license decision.

## Disclaimer

`espectr0` is a calculation aid, not an authority. Results must be reviewed and validated by a qualified structural engineer against the official NSR-10 documents and the project-specific design conditions before use. The authors accept no liability for its use. No warranty, express or implied, is provided.

## License

To be decided. MIT and AGPL-3.0 are under consideration.

---

Part of **sism0 labs** — small tools built and tested before they become products. · `hola@sism0.dev`
