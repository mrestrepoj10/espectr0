export type CalculatorModeId =
  | "nsr10-national"
  | "ccp14"
  | "bogota-microzonation"
  | "medellin-microzonation"
  | "cali-microzonation"
  | "manizales-microzonation"
  | "armenia-microzonation"
  | "pereira-microzonation"
  | "santa-rosa-microzonation"
  | "dosquebradas-microzonation"

export type SourceBlockedModeId = Exclude<
  CalculatorModeId,
  "nsr10-national" | "bogota-microzonation"
>

export type SourceBlockedMode = {
  id: SourceBlockedModeId
  label: string
  description: string
  sourceTitle: string
  sourceUrl: string
  status: string
  blockers: readonly string[]
}

export const calculationModes = [
  {
    id: "nsr10-national",
    label: "NSR-10 Nacional",
    description:
      "Espectro elástico nacional para edificaciones, con los tres niveles de amenaza soportados.",
  },
  {
    id: "ccp14",
    label: "CCP-14 · Puentes",
    description:
      "Publicaciones oficiales de INVÍAS; visible en estado fuente-bloqueado hasta resolver sus datos normativos.",
  },
  {
    id: "bogota-microzonation",
    label: "Bogotá D. C.",
    description:
      "Microzonificación FOPAE 2010, adoptada por el Decreto 523 de 2010 y compilada actualmente por el Decreto 670 de 2025.",
  },
  {
    id: "medellin-microzonation",
    label: "Medellín",
    description:
      "Estudio AMVA/UNAL 1998–2011; disponible como expediente histórico, no como espectro municipal vigente.",
  },
  {
    id: "cali-microzonation",
    label: "Cali",
    description:
      "Microzonificación INGEOMINAS–DAGMA 2005 adoptada mediante el Decreto 0158 de 2014.",
  },
  {
    id: "manizales-microzonation",
    label: "Manizales",
    description:
      "Microzonificación armonizada basada en 1.275 sitios; no admite un selector manual sin la matriz oficial completa.",
  },
  {
    id: "armenia-microzonation",
    label: "Armenia",
    description:
      "Microzonificación posterior al sismo de 1999; la actualización entregada en 2025 sigue pendiente de aprobación y adopción.",
  },
  {
    id: "pereira-microzonation",
    label: "Pereira",
    description:
      "Estudios CARDER/UTP del Eje Cafetero; la nueva actualización tiene aprobación técnica, no adopción municipal demostrada.",
  },
  {
    id: "santa-rosa-microzonation",
    label: "Santa Rosa de Cabal",
    description:
      "Microzonificación CARDER incorporada en 2000; faltan las tablas y ecuaciones del paquete técnico primario.",
  },
  {
    id: "dosquebradas-microzonation",
    label: "Dosquebradas",
    description:
      "Microzonificación CARDER; el POT 2024 publica cinco zonas, pero no la fórmula normativa completa.",
  },
] as const satisfies readonly {
  id: CalculatorModeId
  label: string
  description: string
}[]

export const sourceBlockedModes: Record<SourceBlockedModeId, SourceBlockedMode> = {
  ccp14: {
    id: "ccp14",
    label: "CCP-14 · Puentes",
    description:
      "El corpus oficial fue auditado, pero no permite emitir un espectro local sin completar la selección normativa.",
    sourceTitle: "INVÍAS · Norma Colombiana de Diseño de Puentes CCP-14",
    sourceUrl: "https://www.invias.gov.co/index.php/archivo-y-documentos/documentos-tecnicos/3709-norma-colombiana-de-diseno-de-puentes-ccp-14",
    status: "Fuente oficial localizada · cálculo bloqueado",
    blockers: [
      "No se localizó en la publicación oficial un registro finito verificable de PGA, Ss y S1 por localidad.",
      "La misma edición imprime T₀ = 0,2·Ts en la figura y T₀ = 0,2 s en la definición; no se escogerá una de las dos sin aclaración oficial.",
    ],
  },
  "cali-microzonation": {
    id: "cali-microzonation",
    label: "Cali",
    description:
      "Las curvas de diseño y seguridad limitada están reconstruidas; la activación del modo completo sigue cerrada hasta integrar su contrato trazable.",
    sourceTitle: "Alcaldía de Cali · Decreto 411.0.20.0158 de 2014 e INGEOMINAS–DAGMA 2005",
    sourceUrl: "https://www.cali.gov.co/planeacion/publicaciones/107480/microzonificacion-sismica-de-santiago-de-cali/",
    status: "Dos curvas computables · integración trazable en curso",
    blockers: [
      "La curva de umbral de daño no se calcula: el decreto no publica A0d ni Fa para sus ramas iniciales.",
      "Las curvas soportadas deben conservar citas por celda y fórmula en los mismos exportes normalizados antes de activarse en la interfaz.",
    ],
  },
  "medellin-microzonation": {
    id: "medellin-microzonation",
    label: "Medellín",
    description:
      "La tabla histórica de 14 zonas está transcrita, pero no constituye por sí sola una regla municipal vigente y completa.",
    sourceTitle: "Alcaldía de Medellín · soporte de microzonificación sísmica",
    sourceUrl: "https://www.medellin.gov.co/",
    status: "Expediente histórico completo · activación bloqueada",
    blockers: [
      "La fuente oficial de 2026 indica que el decreto de armonización de 2019 todavía no ha sido adoptado.",
      "Faltan el período de retorno, la ecuación de la rama ascendente y el método de sitio específico referenciado.",
    ],
  },
  "manizales-microzonation": {
    id: "manizales-microzonation",
    label: "Manizales",
    description:
      "La actualización técnica reemplaza las antiguas zonas A/B/C por una salida espacial de 1.275 nodos.",
    sourceTitle: "Alcaldía de Manizales · microzonificación sísmica",
    sourceUrl: "https://manizales.gov.co/",
    status: "Modelo identificado · cálculo manual no reproducible",
    blockers: [
      "No están publicadas como tabla reproducible las 1.275 parejas Fa/Fv ni la ecuación operacional completa.",
      "El producto no usa mapas, coordenadas ni GIS; no se inventarán zonas manuales equivalentes.",
    ],
  },
  "armenia-microzonation": {
    id: "armenia-microzonation",
    label: "Armenia",
    description:
      "El estudio posterior a 1999 es histórico y la actualización armonizada fue entregada en diciembre de 2025.",
    sourceTitle: "Alcaldía de Armenia · entrega de la actualización de microzonificación",
    sourceUrl: "https://www.armenia.gov.co/",
    status: "Actualización entregada · adopción pendiente",
    blockers: [
      "La publicación oficial condiciona su uso a la aprobación de la CAP y a un decreto municipal posterior.",
      "No se encontró el anexo técnico oficial completo del Decreto 079 de 2000 para reconstruir el modelo histórico.",
    ],
  },
  "pereira-microzonation": {
    id: "pereira-microzonation",
    label: "Pereira",
    description:
      "La CAP aprobó técnicamente la nueva microzonificación el 13 de diciembre de 2024.",
    sourceTitle: "CAP · Acta 201, actualización de la microzonificación de Pereira",
    sourceUrl: "https://asosismica.org.co/wp-content/uploads/2025/02/Acta-201-CAP-FINAL_fdo.pdf",
    status: "Aprobación técnica verificada · adopción municipal no demostrada",
    blockers: [
      "La aprobación de la CAP no reemplaza el acto municipal de adopción.",
      "No están disponibles el informe técnico primario, las zonas, las tablas y las fórmulas exactas del nuevo modelo.",
    ],
  },
  "santa-rosa-microzonation": {
    id: "santa-rosa-microzonation",
    label: "Santa Rosa de Cabal",
    description:
      "Los acuerdos municipales prueban la incorporación y siete zonas, pero no aportan el modelo numérico completo.",
    sourceTitle: "Municipio de Santa Rosa de Cabal · Acuerdos 028 y 012 de 2000",
    sourceUrl: "https://www.santarosadecabal-risaralda.gov.co/",
    status: "Cadena de adopción localizada · paquete técnico faltante",
    blockers: [
      "No se localizó el Acuerdo 012 con sus tablas técnicas primarias, valores Am/An y ecuaciones.",
      "No están demostrados los niveles de amenaza, períodos de retorno, amortiguamiento ni reglas de rama.",
    ],
  },
  "dosquebradas-microzonation": {
    id: "dosquebradas-microzonation",
    label: "Dosquebradas",
    description:
      "La Tabla 27 del POT 2024 permite verificar cinco zonas y 30 celdas, pero no cerrar el espectro.",
    sourceTitle: "Alcaldía de Dosquebradas · POT 2024, Tabla 27",
    sourceUrl: "https://www.dosquebradas.gov.co/",
    status: "Tabla directa verificada · fórmula incompleta",
    blockers: [
      "Faltan la fórmula adoptada completa, la inclusividad de sus ramas, Av y el período de retorno.",
      "El POT ordena armonizar el modelo con NSR-10; los valores parciales no se completarán por analogía.",
    ],
  },
}

export function isSourceBlockedMode(
  modeId: CalculatorModeId,
): modeId is SourceBlockedModeId {
  return modeId in sourceBlockedModes
}
