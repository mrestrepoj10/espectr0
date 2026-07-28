# Oraculo independiente de Manizales

Este oraculo no calcula espectros. Su funcion es demostrar de forma independiente, con `Decimal` de 50 digitos, que los pocos parametros cuantitativos bloqueados se trasladaron sin deriva y que todas las rutas de calculo quedan rechazadas.

El registro conserva `Aa=0.25g`, `Av=0.25g`, `I=1`, 1.275 nodos y retorno de 475 anos. La multiplicacion por el factor de importancia es solo un testigo aritmetico, no una formula regulatoria ni un espectro. `spectralSamples` debe permanecer vacio hasta contar con el acto de adopcion vigente, Fa/Fv por sitio, ecuacion por tramos, limites de rama y amortiguamiento.

Regeneracion:

```text
python lib/manizales/oracle/generate_oracle.py
python lib/manizales/oracle/generate_oracle.py --check
```
