# Oráculo independiente de Manizales

Este oráculo reimplementa, con `Decimal` exacto, las cuatro ramas impresas en la
Figura 8.1 a partir de las 21 celdas transcritas de la Figura 8.5. No comparte
código con el motor de TypeScript: existe para que la aritmética del motor se
compare contra algo que se escribió por separado.

Cada registro trae los tokens impresos, las ordenadas en `To`, `Tc` y `TL` con
un épsilon a cada lado, y un bloque `continuity` con los cuatro empalmes.

Ese bloque documenta algo que el estudio publicó y el motor conserva: en la
Zona A los límites impresos están redondeados a la centésima, de modo que la
curva salta de 1.1 g a 1.1034 g en `Tc` y de 0.2207 g a 0.22 g en `TL`. Las
zonas B y C empalman exactamente. No se corrige el redondeo — se transcribe.

Regeneración:

```text
python lib/manizales/oracle/generate_oracle.py
python lib/manizales/oracle/generate_oracle.py --check
```
