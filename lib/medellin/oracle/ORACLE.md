# Independent oracle protocol

`oracle-input.json` is a separate manual transcription of the two six-column blocks in Table 0 (DAP support, May 2011, physical PDF page 22). It is not generated from and does not read `data/canonical.json`.

`generate_oracle.py` uses Python `Decimal` at precision 50. For every one of the 28 zone × hazard rows it verifies the rounded `aSmax × Fa = Samax/I` witness; evaluates the cited plateau and power-decay branches at `T0`, `Tc`, just-left/right and the source-domain endpoint `T=4 s`; and evaluates the cited short-period `Rc` rule with a declared `R=5` witness. It separately locks the program, input, canonical research table and oracle output.

This is intentionally a **partial, negative-capable oracle**, not a production spectrum oracle. It refuses to invent the missing `0 < T < T0` acceleration equation, a return period, or legal adoption. Those omissions are activation blockers, not defaults.
