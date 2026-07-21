# espectr0

**Open-source seismic design spectra for Colombian codes.** A [sism0 labs](https://sism0.dev) project.

`espectr0` builds the elastic design response spectrum for a site in Colombia — pick the location, soil profile and occupancy group, and get the spectrum, the derived coefficients, and an exportable technical record ready for ETABS / SAP2000. It implements the national building code **NSR-10 (Título A)** and the bridge code **CCP-14**.

> **Status: pre-alpha.** The UI shape is locked (see [Design](#design)); the app is being scaffolded. Nothing here is a substitute for a licensed engineer's judgment — see [Disclaimer](#disclaimer).

---

## Why

[EspectroCol](https://www.espectrocol.com/) proved the tool is useful. `espectr0` is an open, auditable take on the same job: the formulas and code tables are in plain sight, the results are reproducible, and the whole thing runs as a fast, no-friction web app. Free and verifiable — the way an engineering tool should be.

## What it does

Given a site and structure, `espectr0` computes the NSR-10 elastic design spectrum across its four branches:

| Range | Sa(T) |
|---|---|
| `T < T₀` (ascending) | `2.5 · Aa · Fa · I · (0.4 + 0.6·T/T₀)` |
| `T₀ ≤ T ≤ Tc` (plateau) | `2.5 · Aa · Fa · I` |
| `Tc < T ≤ T_L` (descending) | `1.2 · Av · Fv · I / T` |
| `T > T_L` (long-period) | `1.2 · Av · Fv · I · T_L / T²` |

…resolving `Aa`, `Av` from the location, `Fa`, `Fv` from the soil profile (Tables A.2.4-3/4), `I` from the occupancy group, and the corner periods `T₀`, `Tc`, `T_L`.

## Modules

| Module | What it does | Status |
|---|---|---|
| **Calculadora** | Elastic design spectrum + site coefficients | In design |
| **Comparador** | Overlay up to 4 spectra (soils, cities, hazard levels) | In design |
| **Cortante basal** | Base shear and vertical force distribution (NSR-10 A.4, A.5.4.5) | Planned |
| **Ajuste dinámico modal** | Dynamic vs. minimum static shear verification | Planned |
| **Microzonificación** | Detailed soil mapping for 8 cities (Bogotá, Medellín, Cali, Manizales, Armenia, Pereira, Santa Rosa, Dosquebradas) | Planned |
| **Memoria PDF** | Sealed technical record with project data and engineer signature | Planned |

Geographic coverage target: 1,117 municipalities (NSR-10), 31 cities (CCP-14), 8 microzonified cities.

## Standards

- **NSR-10** — Reglamento Colombiano de Construcción Sismo Resistente, Título A.
- **CCP-14** — Norma Colombiana de Diseño de Puentes.

Code tables and hazard values are transcribed from the official documents. Where representative values appear in the mockups, they are labelled illustrative — the production build sources the official tables.

## Stack

Mirrors the [sism0-labs](../../sism0-labs) house stack:

- **Next.js 16** · **React 19** · **TypeScript**
- **Tailwind CSS v4** · **shadcn/ui** · **Radix**
- **Geist** (Sans / Mono) · **next-themes**
- **pnpm**

## Getting started

> Commands below apply once the app is scaffolded.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`.

## Design

The interface follows the sism0 / Geist visual language: high contrast, cool neutrals, a single signal-blue accent, dark as the primary theme. Layout is a slim icon rail (global modules) + a simple top navbar + a single-canvas calculator — no multi-step wizard.

The curated UI shape lives in the workspace at [`docs/artifacts/ui-shape.html`](../docs/artifacts/ui-shape.html) — open it in a browser.

## Disclaimer

`espectr0` is a calculation aid, not an authority. Results must be reviewed and validated by a licensed structural engineer against the official NSR-10 / CCP-14 documents before use in design. The authors accept no liability for its use. No warranty, express or implied.

## License

To be decided (MIT or AGPL-3.0 under consideration).

---

Part of **sism0 labs** — small tools built and tested before they become products. · `hola@sism0.dev`
