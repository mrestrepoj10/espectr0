# Regulatory evidence framework

This directory defines source, citation, provenance, lineage, override, source-lock,
coverage, and deterministic-report contracts shared by regulatory studies.

Studies are installed by convention, not through a central manifest. A study owns
`lib/<study-id>/evidence/study.mjs` and exports a stable `studyId` plus an async
`check({ repositoryRoot })` function. `scripts/regulatory/check-evidence.mjs`
discovers these descriptors in sorted order and fails on duplicate IDs. Adding a
study therefore changes only that study's directory.

## Evidence rules

- Every bundled source is SHA-256 locked. PDF checks must also supply a page-count
  reader. External-only or restricted sources keep an official URL and an explicit
  redistribution rationale but no local path.
- Citation rectangles use normalized page coordinates and identify the physical
  page separately from the printed page label. Parent citation IDs prove that
  cells fit inside their rows or tables; page crop and printed-label metadata are
  checked when declared.
- Direct values cite their source, interpolation cites at least two inputs and its
  transformation, and derived values record dependencies, cited inputs, formula,
  substitution, result, and unit. User inputs are classified explicitly.
- Coverage is the exact Cartesian product of declared option, hazard, and field
  IDs. Missing, duplicate, or out-of-domain values fail closed.
- Duplicate source rows require reviewed overrides naming every competing
  occurrence and the chosen occurrence. Unused overrides and citations fail.
- Deterministic JSON uses sorted object keys, preserves semantic array order, and
  always ends with LF.

NSR-10 remains byte-for-byte compatible with its compact schema-v4 manifest and
generator. Its local descriptor runs the existing pinned-source check and adapts
the result, asserting 1,124 raw rows, 1,123 canonical rows, 4,492 field regions,
eight normative citations, source hashes, artifact sizes, and the declared Bogotá
duplicate. The compatibility layer does not change source extraction or numerical
data.
