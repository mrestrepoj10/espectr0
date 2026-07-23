# Regulatory evidence framework

This directory defines source, citation, provenance, lineage, override, source-lock,
coverage, and deterministic-report contracts shared by regulatory studies.

Studies are installed by convention, not through a central manifest. A study owns
`lib/<study-id>/evidence/study.mjs` and exports a stable `studyId` plus an async
`check({ repositoryRoot })` function. Plain Node descriptors import the committed
`lib/regulatory/runtime.mjs` boundary; no TypeScript loader or build output is
required. `scripts/regulatory/check-evidence.mjs` discovers descriptors in sorted
order, strictly validates descriptor/results and their matching IDs, and fails on
duplicate IDs. Adding a study therefore changes only that study's directory.

## Evidence rules

- The top-level checker always reads and SHA-256 locks every bundled source; this
  cannot be omitted by a caller. PDF and text page counts are computed from source
  bytes; other media types require a reader and cannot fall back to declared
  metadata. External-only or restricted sources keep an official URL and
  redistribution rationale and are required to be pathless.
- Citation rectangles use normalized page coordinates and identify the physical
  page separately from the printed page label. Parent citation IDs prove that
  cells fit inside rows and rows inside tables. Every cited physical page requires
  rotation, crop, and an explicit printed label or explicit `null`.
- Bundled citation transcriptions and required tokens are checked against text
  extracted from the hash-locked bytes after Unicode NFKC and whitespace
  normalization. Text media is scoped to its form-feed-delimited physical page;
  PDF text items must intersect the declared normalized region. Citation-bearing
  bundled media without a built-in extractor fails closed.
- Every direct scalar has exactly one cell citation whose normalized value, unit,
  and transformation match. Interpolation cites at least two cell inputs. Derived
  lineage separates a clause/equation formula citation from per-dependency input
  citations and rejects unrelated evidence. User inputs are classified explicitly.
- Values and raw/canonical rows cover the exact option × hazard × field product.
  Rows have exact keys/field sets, every raw occurrence is consumed, and canonical
  fields must equal both the selected source occurrence and canonical values.
- Duplicate source rows require reviewed overrides naming every competing
  occurrence, its cell citations per direct/interpolated field, and the chosen
  occurrence. Each duplicate row is limited to those field cells or their own row
  ancestry; canonicalization must use the reviewed selection, occurrence regions
  must be distinct, and unused overrides and citations fail.
- Deterministic JSON uses sorted object keys, preserves semantic array order, and
  always ends with LF.

NSR-10 remains byte-for-byte compatible with its compact schema-v4 manifest and
generator. Its local descriptor runs the existing pinned-source check and adapts
the result, asserting 1,124 raw rows, 1,123 canonical rows, 4,492 field regions,
eight normative citations, source hashes, artifact sizes, and the declared Bogotá
duplicate. The compatibility layer does not change source extraction or numerical
data.

`lib/regulatory/evidence/study.mjs` is an installed two-document contract sentinel.
It imports and executes the same generic runtime through the production aggregate
path, proving bundled and pathless-external sources, exact cell evidence, role-based
lineage, locks, coverage, and strict report validation on every `evidence:check`.
