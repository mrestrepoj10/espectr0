# Independent oracle protocol

`oracle-input.json` was manually transcribed from the three official FOPAE tables independently of `data/canonical.json` and `evidence/generate.mjs`. `generate_oracle.py` reads only that input and uses Python `decimal.Decimal` at precision 50.

For each of the 48 option×hazard rows it records:

- the six input fields as decimal strings;
- formula-derived boundary periods and table-minus-formula residuals;
- the plateau-to-decay join gap at the direct tabulated boundary;
- branch/value witnesses at zero, tabulated joins, interior points, the long-period boundary, and twice the long-period boundary.

Branch selection always uses the direct period printed in the adopted table. Formula-derived periods are diagnostic only. The F3 descriptor separately compares the independently transcribed inputs against all canonical rows and fails on any mismatch.
