# NSR-10 independent oracle provenance

The version 1 oracle named four inputs, but only three were present in the
repository. Its municipality SHA-256 (`2cb6d2…`) is the exact LF-byte hash of
`lib/nsr10/data/municipios.json` as introduced by commit `c47d49a`. Commit
`4ff75df` subsequently added DANE codes and the published Ae/Ad columns and
reformatted the 1,123 rows. A regression check proves that every original
department/municipality pair retained the same Aa and Av values. The current
canonical LF-byte hash is recorded in the generated oracle instead of claiming
that the historical file is still current.

The referenced `data/spectrum-formulas.md` (`c076282…`) was never committed.
It is absent from reachable history, local unreachable Git objects, and the
named source repository (`mrestrepoj10/sism0`, which is empty). Its bytes and
claimed hash therefore cannot be independently validated, so the reference is
retired rather than reconstructed from an unverifiable description.

Version 2 replaces that missing path with two immutable, checked-in inputs:

- `oracle-input.json` independently repeats the coefficient tables, importance
  factors, fixed periods, case inputs, complete A.2.6-1 through A.2.6-6 formula
  inventory, machine-validated units, and pinned PDF lock.
- `scripts/generate-nsr10-oracle.py` implements the arithmetic with Python
  `Decimal` at 50-digit precision. It does not import the TypeScript engine or
  read production canonical JSON while calculating expected results.

For compatibility with the version 1 runtime schema, `oracle.json` retains the
key `spectrum_formulas`, but it now locks the complete `oracle-input.json`
instead of naming unavailable bytes. The input declares the generator hash;
the generated oracle declares its input and current canonical regulatory JSON
hashes. `evidence:check` verifies every lock, the pinned PDF hash and page count,
all oracle case inputs against the canonical municipality data, and
byte-for-byte reproduction of `oracle.json`.

The units contract classifies T/fixed periods, emitted period values and their
decimal witnesses, and T0/TC/TL as seconds; Aa, Av, Sa/Sa-max and their decimal
witnesses, and the absolute binary64 tolerance as fractions of g; and Fa, Fv,
and I as dimensionless. The same contract and formula inventory are emitted in
the generated oracle and validated by the runtime Zod schema.
