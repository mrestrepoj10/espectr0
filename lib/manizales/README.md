# Dossier F3 - microzonificacion sismica de Manizales

Estado: **investigacion completa para decision; activacion y merge al motor bloqueados**.

## Conclusion

No existe una base primaria completa para ofrecer Manizales en el calculador bajo las restricciones del producto. Se recuperaron y bloquearon las copias oficiales UNGRD del informe Uniandes 2002, el informe de armonizacion 2014 y su presentacion. El modelo 2002 define tres zonas de diseno A/B/C. La armonizacion 2014 las reemplaza por un modelo rasterizado de 1.275 sitios. El producto, en cambio, exige un selector manual sin coordenadas, GIS ni mapas, y las fuentes no publican los 1.275 pares Fa/Fv ni una regla oficial para convertirlos en categorias manuales.

Tampoco se recupero un instrumento primario que pruebe la adopcion y vigencia de la actualizacion armonizada. El informe oficial municipal de cierre 2016-2019 incluyo “adoptar e implementar” esa microzonificacion entre los asuntos en desarrollo. Una respuesta de Planeacion de 2025 confirma que el Acuerdo 0958 de 2017 sigue siendo el POT vigente, pero esa comunicacion no adopta ni acredita por si sola la microzonificacion.

## Reconciliacion de modelos

| Capa | Modelo | Uso permitido en este paquete |
|---|---|---|
| Uniandes 2002 | Tres zonas de diseno: A (ceniza), B (rellenos), C (roca/suelo delgado) | Historia solamente. El PDF oficial original no pudo bloquearse y no se activa. |
| Armonizacion 2014 / publicacion 2015 | 1.275 nodos; Fa/Fv por ubicacion; salida superficial/de diseno rasterizada documentada a 475 anos | Candidato tecnico gobernante, pero no computable ni seleccionable manualmente con las fuentes disponibles. |
| Sitio web de referencia | Cualquier representacion o valor que muestre | Solo comparacion. Nunca fuente de coeficientes, formulas, derecho, redondeo o advertencias. |

La presentacion oficial de 2014 publica la forma espectral NSR-10, identifica `T0`, `Tc` y `TL`, declara 5% de amortiguamiento y fija `Aa=0.25g`, `Av=0.25g` e `I=1`; Fa/Fv permanecen como parametros libres por nodo. Esto resuelve la forma matematica general, pero no el dato espacial necesario para calcular un sitio. La publicacion de 2015 afirma compatibilidad tecnica con la NSR-10 para edificaciones nuevas una vez definido el espectro del sitio. Esa afirmacion no prueba adopcion municipal.

## Fuentes y redistribucion

Se bloquearon seis PDFs primarios mediante URL, SHA-256, longitud y paginacion: el informe 2002, el informe y la presentacion 2014 alojados por UNGRD, la publicacion tecnica de 2015, el informe de gestion municipal 2016-2019 y una respuesta oficial de Planeacion de 2025. Todos son `external-only`; no se versionan PDFs, imagenes ni recortes.

La copia oficial 2002 tiene 160 paginas, pero omite materialmente la Figura 8.5 entre las paginas impresas 149 y 150, aun cuando el texto dice que esa figura contiene las ecuaciones y graficas A/B/C. La presentacion oficial 2014 conserva una grafica reducida del modelo historico, pero no se digitaliza como sustituto de la figura omitida. El eventual acto de adopcion sigue sin recuperarse. La coleccion municipal de decretos si es publica: el 28 de julio de 2026 se abrio anonimamente y se enumeraron 2.523 archivos en las carpetas expuestas de 2004 y 2013-2025. La busqueda reproducible de titulos no encontro nombres con `microzon` o `sism`; este resultado por nombre no revisa el contenido de cada decreto, no prueba inexistencia y tampoco acredita vigencia.

El alcance por periodo del modelo historico tambien queda directo: el informe 2002 presenta los espectros solo hasta 3.0 s y, en su literal 8.3(e), exige analisis sismicos especiales para estructuras con periodo fundamental mayor o igual a 2.0 s. Esta regla pertenece exclusivamente al modelo 2002 y no se proyecta sobre el candidato raster 2014/2015 sin una fuente separada.

## Cobertura y limites

- Matriz exacta: 1 opcion tecnica x 1 amenaza x 5 campos numericos, todos con celda y atestacion directa. La naturaleza raster y Fa/Fv se cubren como aplicabilidad textual porque F3 solo admite normalizacion numerica directa.
- Inventario de formulas: 4/4 asuntos clasificados y 50% de cobertura operacional. La forma y el amortiguamiento estan publicados; faltan los valores Fa/Fv por sitio y una regla de seleccion manual.
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
- `evidence/verify_official_pdf.py`: reproduce hashes, paginas y recortes del corpus externo bloqueado.
- `evidence/formula-inventory.json`, `claims-matrix.json`, `uncertainty-ledger.json`, `conflict-ledger.json`: trazabilidad de formulas, afirmaciones y bloqueos.
- `oracle/`: oraculo independiente negativo; no produce muestras espectrales.

## Condiciones minimas para reconsiderar activacion

1. Obtener una tabla o servicio oficial reproducible con los 1.275 pares Fa/Fv y una regla primaria compatible con seleccion manual; si la autoridad solo ofrece GIS, cambiar primero el alcance del producto.
2. Si se pretende ofrecer el modelo historico, obtener una copia primaria completa de la Figura 8.5; no digitalizar la grafica reducida de la presentacion ni copiar valores del sitio comparador.
3. Completar revision humana independiente del paquete antes del merge.

Hasta entonces: **no motor, no UI, no selector A/B/C presentado como vigente, no activacion y no merge funcional**.
