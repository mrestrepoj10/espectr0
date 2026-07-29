# Independent Decimal spectrum oracle

`oracle-input.json` is a second, manually typed transcription of Table 27. The Python program uses `Decimal` arithmetic, derives `Av` by algebraically inverting NSR-10 A.2.6-2, and evaluates just-left/exact/right witnesses for `To`, `Tc`, and `TL`.

The oracle does not import or read the TypeScript engine. Values below `To` and above `TL` are emitted as typed unsupported cases; no long-period extrapolation is invented.
