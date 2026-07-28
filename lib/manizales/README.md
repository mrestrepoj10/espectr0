# Dossier F3 - microzonificacion sismica de Manizales

Estado: **investigacion completa para decision; activacion y merge al motor bloqueados**.

## Conclusion

No existe una base primaria completa para ofrecer Manizales en el calculador bajo las restricciones del producto. La publicacion tecnica de 2015 reemplaza el esquema historico A/B/C por un modelo rasterizado de 1.275 sitios. El producto, en cambio, exige un selector manual sin coordenadas, GIS ni mapas. La publicacion tampoco contiene los 1.275 pares Fa/Fv, la ecuacion espectral operacional completa, sus limites de rama ni el amortiguamiento del espectro de salida.

Tampoco se recupero un instrumento primario que pruebe la adopcion y vigencia de la actualizacion armonizada. El informe oficial municipal de cierre 2016-2019 incluyo “adoptar e implementar” esa microzonificacion entre los asuntos en desarrollo. Una respuesta de Planeacion de 2025 confirma que el Acuerdo 0958 de 2017 sigue siendo el POT vigente, pero esa comunicacion no adopta ni acredita por si sola la microzonificacion.

## Reconciliacion de modelos

| Capa | Modelo | Uso permitido en este paquete |
|---|---|---|
| Uniandes 2002 | Tres zonas de diseno: A (ceniza), B (rellenos), C (roca/suelo delgado) | Historia solamente. El PDF oficial original no pudo bloquearse y no se activa. |
| Armonizacion 2014 / publicacion 2015 | 1.275 nodos; Fa/Fv por ubicacion; salida superficial/de diseno rasterizada documentada a 475 anos | Candidato tecnico gobernante, pero no computable ni seleccionable manualmente con las fuentes disponibles. |
| Sitio web de referencia | Cualquier representacion o valor que muestre | Solo comparacion. Nunca fuente de coeficientes, formulas, derecho, redondeo o advertencias. |

La publicacion de 2015 fija `Aa=0.25g`, `Av=0.25g` e `I=1` para el procedimiento de ajuste, y trata Fa/Fv como parametros libres por nodo. Afirma compatibilidad tecnica con la NSR-10 para edificaciones nuevas una vez definido el espectro del sitio. Esa afirmacion no prueba adopcion municipal.

## Fuentes y redistribucion

Se bloquearon tres PDFs primarios mediante URL, SHA-256, longitud y paginacion: la publicacion tecnica de 2015 alojada por la Universitat Politecnica de Catalunya, el informe de gestion municipal 2016-2019 y una respuesta oficial de Planeacion de 2025. Todos son `external-only`; no se versionan PDFs, imagenes ni recortes.

El informe original 2002, la armonizacion completa 2014 y el eventual acto de adopcion figuran como fuentes no recuperadas. El repositorio UNGRD redirigio los dos primeros a un endpoint inaccesible desde el entorno. La coleccion municipal de decretos si es publica: el 28 de julio de 2026 se abrio anonimamente y se enumeraron 2.523 archivos en las carpetas expuestas de 2004 y 2013-2025. La busqueda reproducible de titulos no encontro nombres con `microzon` o `sism`; cinco coincidencias contextuales con `armoniz` o `geotecn` correspondieron a presupuesto o ajustes de tratamiento geotecnico, no a un acto identificado de adopcion. Este resultado por nombre no revisa el contenido de cada decreto, no prueba inexistencia y tampoco acredita vigencia: la coleccion solo exponia un archivo de 2025 y ninguna carpeta de 2026 al observarla. No se asignaron huellas ficticias ni se convirtio la ausencia de coincidencias en una afirmacion de inexistencia.

## Cobertura y limites

- Matriz exacta: 1 opcion tecnica x 1 amenaza x 5 campos numericos, todos con celda y atestacion directa. La naturaleza raster y Fa/Fv se cubren como aplicabilidad textual porque F3 solo admite normalizacion numerica directa.
- Inventario de formulas: 4/4 asuntos clasificados, pero cobertura operacional 0%; ese cero es un bloqueo, no un vacio oculto.
- Advertencias y aplicabilidad: 100% de las afirmaciones aceptadas tienen cita o disposicion explicita de bloqueo.
- Amenaza: esta matriz solo normaliza la salida superficial/de diseno de 475 anos documentada por el articulo bloqueado de 2015. No afirma que el corpus completo carezca de otros UHS en roca, ni infiere otros niveles o amortiguamiento.
- Sitio especifico: el modelo depende de ubicacion y datos espaciales ausentes. No se interpolan nodos ni se crean zonas manuales.
- Edificaciones: existe una declaracion tecnica de compatibilidad NSR-10, condicionada a definir el espectro local; no autoriza calculo ni sustituye la verificacion legal.

## Archivos

- `data/canonical.json`: canon de investigacion, siempre inactivable.
- `evidence/manifest.json`: contrato F3 con cobertura exacta y regiones.
- `evidence/source-locks.json`: fuentes bloqueadas y fuentes faltantes sin datos inventados.
- `evidence/verify_decree_index.py`: reproduce la enumeracion publica de titulos y detecta cambios frente a la instantanea bloqueada; requiere red.
- `evidence/extraction-attestation.json`: huellas de texto y recortes temporales, enlazadas a los locks.
- `evidence/verify_official_pdf.py`: reproduce hashes, paginas y recortes cuando el revisor aporta los tres PDFs externos y `pdftoppm`.
- `evidence/formula-inventory.json`, `claims-matrix.json`, `uncertainty-ledger.json`, `conflict-ledger.json`: trazabilidad de formulas, afirmaciones y bloqueos.
- `oracle/`: oraculo independiente negativo; no produce muestras espectrales.

## Condiciones minimas para reconsiderar activacion

1. Recuperar y bloquear el acto oficial de adopcion, junto con su vigencia, modificaciones y derogatorias.
2. Recuperar el estudio original 2002 y la armonizacion completa 2014 con bytes verificables.
3. Obtener una tabla o servicio oficial reproducible con los 1.275 pares Fa/Fv y una regla primaria compatible con seleccion manual; si la autoridad solo ofrece GIS, cambiar primero el alcance del producto.
4. Obtener la ecuacion por tramos, limites, amortiguamiento, reglas de frontera y advertencias de sitio especifico.
5. Completar revision humana independiente.

Hasta entonces: **no motor, no UI, no selector A/B/C presentado como vigente, no activacion y no merge funcional**.
