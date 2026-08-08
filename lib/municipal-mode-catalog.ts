export type CalculatorModeId =
  | "nsr10-national"
  | "ccp14"
  | "bogota-microzonation"
  | "medellin-microzonation"
  | "cali-microzonation"
  | "manizales-microzonation"
  | "pereira-microzonation"
  | "santa-rosa-microzonation"
  | "dosquebradas-microzonation"

export type SourceBlockedModeId = Exclude<
  CalculatorModeId,
  | "nsr10-national"
  | "ccp14"
  | "bogota-microzonation"
  | "medellin-microzonation"
  | "cali-microzonation"
  | "dosquebradas-microzonation"
  | "manizales-microzonation"
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
      "Procedimiento General de puentes con PGA, Ss y S1 leídos de los mapas oficiales y el perfil de sitio del proyecto.",
  },
  {
    id: "bogota-microzonation",
    label: "Bogotá D. C.",
    description:
      "Cálculo manual por zona con la microzonificación FOPAE 2010, adoptada por el Decreto 523 de 2010 y compilada por el Decreto 670 de 2025.",
  },
  {
    id: "medellin-microzonation",
    label: "Medellín",
    description:
      "Cálculo manual en 14 zonas con las familias históricas de diseño (5 %) y control de daños (2 %), limitado a T0 ≤ T ≤ 4 s.",
  },
  {
    id: "cali-microzonation",
    label: "Cali",
    description:
      "Cálculo manual por zona o componente con la microzonificación INGEOMINAS–DAGMA 2005 adoptada mediante el Decreto 0158 de 2014.",
  },
  {
    id: "manizales-microzonation",
    label: "Manizales",
    description:
      "Cálculo manual en las tres zonas de la Figura 8.5 del estudio Uniandes 2002, con las cuatro ramas impresas en la Figura 8.1.",
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
      "Cálculo manual en cinco zonas de la Tabla 27 del POT 2024, limitado al intervalo soportado To ≤ T ≤ TL.",
  },
] as const satisfies readonly {
  id: CalculatorModeId
  label: string
  description: string
}[]

export const sourceBlockedModes: Record<SourceBlockedModeId, SourceBlockedMode> = {
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
    sourceUrl: "https://tramites1.suit.gov.co/registro-web/suit_descargar_archivo?A=78028",
    status: "Cadena de adopción localizada · paquete técnico faltante",
    blockers: [
      "No se localizó el Acuerdo 012 con sus tablas técnicas primarias, valores Am/An y ecuaciones.",
      "No están demostrados los niveles de amenaza, períodos de retorno, amortiguamiento ni reglas de rama.",
    ],
  },
}

export function isSourceBlockedMode(
  modeId: CalculatorModeId,
): modeId is SourceBlockedModeId {
  return modeId in sourceBlockedModes
}
