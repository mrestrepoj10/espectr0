import {
  Circle,
  Document,
  Line,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer"

import {
  calculationMemoriaFilename,
  collectMemoriaSource,
  createSpectrumChartGeometry,
  flattenTracePoints,
  formatTraceNumber,
  normalizePdfText,
  selectRepresentativeBoundaryPoints,
} from "./memoria-pdf"

import type { CalculationStep, CalculationTrace } from "./nsr10"
import type { SiteCoefficientInterpolationTrace } from "./nsr10/site-coefficients"

const colors = {
  ink: "#172033",
  muted: "#5E687A",
  faint: "#E7EAF0",
  paper: "#FFFFFF",
  panel: "#F6F7FA",
  blue: "#2864DC",
  blueSoft: "#EAF0FF",
  amber: "#9A5B06",
  amberSoft: "#FFF5DF",
  green: "#176B45",
  greenSoft: "#E9F7F0",
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.45,
    paddingBottom: 44,
    paddingHorizontal: 42,
    paddingTop: 22,
  },
  headerBrand: {
    color: colors.muted,
    fontSize: 7.5,
    left: 42,
    position: "absolute",
    top: 22,
    width: 330,
  },
  headerLocation: {
    color: colors.muted,
    fontSize: 7.5,
    position: "absolute",
    right: 42,
    textAlign: "right",
    top: 22,
    width: 181,
  },
  headerRule: {
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    left: 42,
    position: "absolute",
    right: 42,
    top: 41,
  },
  headerSpacer: {
    height: 27,
    marginBottom: 8,
  },
  spectrumHeader: {
    borderBottomColor: colors.faint,
    borderBottomWidth: 1,
    color: colors.muted,
    fontSize: 7.5,
    marginBottom: 8,
    paddingBottom: 7,
  },
  footerRule: {
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    left: 42,
    position: "absolute",
    right: 42,
    top: 806,
  },
  footerLeft: {
    color: colors.muted,
    fontSize: 7,
    left: 42,
    position: "absolute",
    top: 816,
  },
  footerRight: {
    color: colors.muted,
    fontSize: 7,
    position: "absolute",
    right: 42,
    textAlign: "right",
    top: 816,
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.1,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.12,
    marginBottom: 7,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 1.45,
    marginBottom: 17,
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    borderBottomColor: colors.blue,
    borderBottomWidth: 1.5,
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 9,
    paddingBottom: 5,
  },
  sectionIntro: { color: colors.muted, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  metric: {
    backgroundColor: colors.panel,
    borderColor: colors.faint,
    borderRadius: 4,
    borderWidth: 1,
    width: "24%",
    padding: 9,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 7,
    letterSpacing: 0.4,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  metricValue: { fontSize: 14, fontWeight: 700 },
  notice: {
    backgroundColor: colors.amberSoft,
    borderColor: "#F1D493",
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 14,
    padding: 10,
  },
  noticeTitle: { color: colors.amber, fontWeight: 700, marginBottom: 3 },
  evidence: {
    backgroundColor: colors.blueSoft,
    borderColor: "#CAD8FF",
    borderRadius: 4,
    borderWidth: 1,
    width: "49%",
    padding: 9,
  },
  evidenceTitle: { color: colors.blue, fontWeight: 700, marginBottom: 3 },
  table: { borderColor: colors.faint, borderWidth: 1 },
  tableRow: { flexDirection: "row" },
  tableLabel: {
    backgroundColor: colors.panel,
    borderBottomColor: colors.faint,
    borderBottomWidth: 1,
    color: colors.muted,
    padding: 6,
    width: "34%",
  },
  tableValue: {
    borderBottomColor: colors.faint,
    borderBottomWidth: 1,
    padding: 6,
    width: "66%",
  },
  card: {
    borderColor: colors.faint,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 8,
    padding: 9,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  cardTitle: { fontSize: 10, fontWeight: 700, width: "72%" },
  reference: { color: colors.blue, fontSize: 7.5, textAlign: "right", width: "28%" },
  equation: {
    backgroundColor: colors.panel,
    borderRadius: 3,
    fontFamily: "Courier",
    fontSize: 8,
    marginBottom: 5,
    padding: 6,
  },
  substitution: { color: colors.muted, fontFamily: "Courier", fontSize: 7.5 },
  result: { color: colors.green, fontWeight: 700, marginTop: 5 },
  chip: {
    backgroundColor: colors.greenSoft,
    borderRadius: 3,
    color: colors.green,
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  chartFrame: {
    borderColor: colors.faint,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 12,
    padding: 8,
  },
  chartCaption: { color: colors.muted, fontSize: 7.5, marginTop: 3, textAlign: "center" },
  sourceItem: {
    borderBottomColor: colors.faint,
    borderBottomWidth: 1,
    marginBottom: 6,
    paddingBottom: 6,
  },
  sourceTitle: { fontWeight: 700, marginBottom: 2 },
  sourceDetail: { color: colors.muted, fontSize: 7.5 },
  hash: { color: colors.muted, fontFamily: "Courier", fontSize: 6.5 },
})

function RunningFrame({
  trace,
  section,
}: {
  trace: CalculationTrace
  section: string
}) {
  const sectionLabel = {
    resumen: "resumen",
    interpolacion: "interpolación",
    parametros: "parámetros",
    espectro: "espectro",
    comprobaciones: "comprobaciones",
  }[section] ?? section
  const location = traceLocation(trace)
  return (
    <>
      <Text key={`header-left-${section}`} style={styles.headerBrand}>
        espectr0 · memoria de cálculo · {sectionLabel}
      </Text>
      <Text key={`header-right-${section}`} style={styles.headerLocation}>
        {location}
      </Text>
      <View key={`header-rule-${section}`} style={styles.headerRule} />
      <View key={`header-spacer-${section}`} style={styles.headerSpacer} />
      <PageFooter section={section} trace={trace} />
    </>
  )
}

function traceLocation(trace: CalculationTrace) {
  return trace.context.municipality
    ? `${trace.context.municipality.name}, ${trace.context.municipality.department}`
    : "Sin municipio"
}

function PageFooter({
  trace,
  section,
}: {
  trace: CalculationTrace
  section: string
}) {
  return (
    <>
      <View fixed key={`footer-rule-${section}`} style={styles.footerRule} />
      <Text fixed key={`footer-left-${section}`} style={styles.footerLeft}>
        NSR-10 · esquema de traza v{trace.schemaVersion}
      </Text>
      <Text
        fixed
        key={`footer-right-${section}`}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        style={styles.footerRight}
      />
    </>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

function StepCard({ step }: { step: CalculationStep }) {
  const substitution = normalizePdfText(step.substitution).replace(
    /-?\d+\.\d{7,}/g,
    (value) => formatTraceNumber(Number(value), 6),
  )
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{normalizePdfText(step.label)}</Text>
        <Text style={styles.reference}>{normalizePdfText(step.reference)}</Text>
      </View>
      <Text style={styles.equation}>{normalizePdfText(step.formula)}</Text>
      <Text style={styles.substitution}>
        Sustitución: {substitution}
      </Text>
      <Text style={styles.result}>
        Resultado: {formatTraceNumber(step.result, 6)} {step.unit}
      </Text>
    </View>
  )
}

function InputRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={styles.tableLabel}>{label}</Text>
      <Text style={styles.tableValue}>{value}</Text>
    </View>
  )
}

function InterpolationCard({
  title,
  trace,
}: {
  title: string
  trace: SiteCoefficientInterpolationTrace | null
}) {
  if (!trace) {
    return (
      <View style={styles.card} wrap={false}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={{ color: colors.muted, marginTop: 5 }}>
          No aplica a este nivel de amenaza según la traza de cálculo.
        </Text>
      </View>
    )
  }

  const mode = {
    exact: "columna exacta",
    fraction: "interpolación lineal",
    clamped: "valor limitado al extremo de la tabla",
  }[trace.mode]
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.chip}>{trace.tableId}</Text>
      </View>
      <Text>
        Perfil {trace.soilProfile} · {trace.inputParameter} = {formatTraceNumber(trace.input)} · {mode}
      </Text>
      <Text style={{ color: colors.muted, marginTop: 4 }}>
        Extremos: ({formatTraceNumber(trace.lower.breakpoint)}, {formatTraceNumber(trace.lower.value)}) y ({formatTraceNumber(trace.upper.breakpoint)}, {formatTraceNumber(trace.upper.value)}). Fracción = {formatTraceNumber(trace.fraction, 6)}.
      </Text>
      <Text style={styles.result}>
        {trace.coefficient === "fa" ? "Fa" : "Fv"} = {formatTraceNumber(trace.result, 6)}
      </Text>
    </View>
  )
}

function SpectrumChart({ trace }: { trace: CalculationTrace }) {
  const points = flattenTracePoints(trace)
  const geometry = createSpectrumChartGeometry(points)
  const { plotLeft, plotTop, plotWidth, plotHeight } = geometry
  const baseline = plotTop + plotHeight
  const maxPoint = points.reduce((current, point) =>
    point.sa > current.sa ? point : current,
  )
  const maxX = plotLeft + (maxPoint.t / geometry.maxT) * plotWidth
  const maxY = plotTop + plotHeight - (maxPoint.sa / geometry.maxSa) * plotHeight

  return (
    <View style={styles.chartFrame} wrap={false}>
      <Svg height={geometry.height} viewBox={`0 0 ${geometry.width} ${geometry.height}`} width={geometry.width}>
        <Rect fill="#FFFFFF" height={geometry.height} width={geometry.width} x={0} y={0} />
        {[0.25, 0.5, 0.75].map((fraction) => (
          <Line
            key={fraction}
            stroke={colors.faint}
            strokeWidth={0.7}
            x1={plotLeft}
            x2={plotLeft + plotWidth}
            y1={plotTop + plotHeight * fraction}
            y2={plotTop + plotHeight * fraction}
          />
        ))}
        <Line stroke={colors.muted} strokeWidth={0.8} x1={plotLeft} x2={plotLeft} y1={plotTop} y2={baseline} />
        <Line stroke={colors.muted} strokeWidth={0.8} x1={plotLeft} x2={plotLeft + plotWidth} y1={baseline} y2={baseline} />
        <Path d={geometry.path} fill="none" stroke={colors.blue} strokeWidth={2} />
        <Circle cx={maxX} cy={maxY} fill={colors.paper} r={3} stroke={colors.blue} strokeWidth={1.5} />
      </Svg>
      <Text style={styles.chartCaption}>
        Sa (g) vs. período T (s) · 0 a {formatTraceNumber(geometry.maxT, 2)} s · Sa máx. graficada {formatTraceNumber(maxPoint.sa, 3)} g
      </Text>
    </View>
  )
}

function ExecutivePage({ trace }: { trace: CalculationTrace }) {
  const source = collectMemoriaSource(trace)
  const stepById = new Map(trace.steps.map((step) => [step.id, step]))
  const municipality = trace.context.municipality
  const hazardLabel = {
    design: "Diseño",
    "limited-safety": "Seguridad limitada",
    "damage-threshold": "Umbral de daño",
  }[trace.context.hazardLevel]

  return (
    <Page size="A4" style={styles.page}>
      <RunningFrame section="resumen" trace={trace} />
      <Text style={styles.eyebrow}>Memoria reproducible · NSR-10</Text>
      <Text style={styles.title}>Espectro elástico de respuesta</Text>
      <Text style={styles.subtitle}>
        {municipality ? `${municipality.name}, ${municipality.department}` : "Municipio no informado"} · {hazardLabel} · período de retorno {trace.context.returnPeriodYears} años · amortiguamiento {formatTraceNumber(trace.context.dampingRatio * 100)} %
      </Text>

      <View style={[styles.row, { marginBottom: 16 }]}>
        {[
          ["Sa máx.", stepById.get("sa-max")],
          ["PGA", stepById.get("pga")],
          ["TC", stepById.get("tc")],
          ["TL", stepById.get("tl")],
        ].map(([label, step]) => (
          <View key={String(label)} style={styles.metric}>
            <Text style={styles.metricLabel}>{String(label)}</Text>
            <Text style={styles.metricValue}>
              {typeof step === "object" ? `${formatTraceNumber(step.result, 3)} ${step.unit}` : "-"}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.notice} wrap={false}>
        <Text style={styles.noticeTitle}>Alcance y aplicabilidad</Text>
        <Text>
          Esta memoria documenta el espectro elástico generado a partir de la traza. No verifica el sistema estructural, regularidad, método de análisis, interacción suelo-estructura ni requisitos particulares del proyecto. No reemplaza la revisión profesional ni la consulta del texto normativo vigente.
        </Text>
      </View>

      <View style={[styles.row, { marginBottom: 16 }]} wrap={false}>
        <View style={styles.evidence}>
          <Text style={styles.evidenceTitle}>Nivel 1 · Reproducibilidad</Text>
          <Text>
            Entradas, interpolaciones, fórmulas, sustituciones y resultados se conservan en una traza serializable y determinística.
          </Text>
        </View>
        <View style={styles.evidence}>
          <Text style={styles.evidenceTitle}>Nivel 2 · Verificación independiente</Text>
          <Text>
            Requiere contrastar los datos y referencias con la fuente oficial. Esta memoria facilita esa revisión, pero no la sustituye.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle>Entradas y procedencia</SectionTitle>
        <View style={styles.table}>
          <InputRow label="Municipio" value={municipality ? `${municipality.name} (${municipality.code}), ${municipality.department}` : "No informado"} />
          <InputRow label="Amenaza" value={`${hazardLabel} · ${trace.context.returnPeriodYears} años`} />
          <InputRow label="Perfil / grupo / modo" value={`${trace.inputs.soilProfile} / ${trace.inputs.importanceGroup} / ${trace.inputs.mode}`} />
          <InputRow label="Aa / Av / Ae / Ad" value={`${formatTraceNumber(trace.inputs.aa)} / ${formatTraceNumber(trace.inputs.av)} / ${trace.inputs.ae === null ? "N/A" : formatTraceNumber(trace.inputs.ae)} / ${trace.inputs.ad === null ? "N/A" : formatTraceNumber(trace.inputs.ad)}`} />
          <InputRow label="Fuente municipal" value={source.municipalityPage ? `${source.appendix}, página impresa ${source.municipalityPrintedPage} (página PDF ${source.municipalityPage})` : "Sin cita municipal disponible"} />
          <InputRow label="Documento" value={source.document} />
        </View>
      </View>
    </Page>
  )
}

function InterpolationPage({ trace }: { trace: CalculationTrace }) {
  return (
    <Page size="A4" style={styles.page}>
      <RunningFrame section="interpolacion" trace={trace} />
      <View style={styles.section}>
        <SectionTitle>Interpolación de Fa y Fv</SectionTitle>
        <Text style={styles.sectionIntro}>
          Los extremos, la fracción y el modo se leen directamente de la evidencia de interpolación incluida en la traza.
        </Text>
        <InterpolationCard title="Coeficiente de amplificación de período corto Fa" trace={trace.siteCoefficients.fa} />
        <InterpolationCard title="Coeficiente de amplificación de período intermedio Fv" trace={trace.siteCoefficients.fv} />
      </View>
      <View style={styles.notice} wrap={false}>
        <Text style={styles.noticeTitle}>Criterio documentado por la traza</Text>
        <Text>
          La memoria presenta el modo exacto, interpolado o limitado; los dos puntos tabulados y la fracción empleada. Los valores no se reconstruyen dentro del PDF.
        </Text>
      </View>
    </Page>
  )
}

function DerivedProofPage({ trace }: { trace: CalculationTrace }) {
  const derived = trace.steps.filter(({ id }) => id !== "fa" && id !== "fv")
  return (
    <Page size="A4" style={styles.page} wrap>
      <RunningFrame section="parametros" trace={trace} />
      <View style={styles.section}>
        <SectionTitle>Parámetros derivados · bloques de prueba</SectionTitle>
        <Text style={styles.sectionIntro}>
          Cada bloque conserva referencia, fórmula, sustitución, resultado, unidad y dependencias del contrato CalculationTrace.
        </Text>
        {derived.map((step) => <StepCard key={step.id} step={step} />)}
      </View>
    </Page>
  )
}

function SpectrumPage({ trace }: { trace: CalculationTrace }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.spectrumHeader}>
        espectr0 · memoria de cálculo · espectro · {traceLocation(trace)}
      </Text>
      <View style={styles.section}>
        <SectionTitle>Espectro por tramos</SectionTitle>
        <Text style={styles.sectionIntro}>
          La curva se dibuja exclusivamente con los puntos contenidos en la traza; no se recalculan ordenadas en la presentación PDF.
        </Text>
        <SpectrumChart trace={trace} />
        {trace.branches.map((branch) => (
          <View key={branch.id} style={styles.card} wrap={false}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{normalizePdfText(branch.label)}</Text>
              <Text style={styles.reference}>{normalizePdfText(branch.reference)}</Text>
            </View>
            <Text style={styles.equation}>{normalizePdfText(branch.formula)}</Text>
            <Text style={{ color: colors.muted }}>{normalizePdfText(branch.condition)}</Text>
            <Text style={{ color: colors.muted, fontSize: 7.5, marginTop: 4 }}>
              {branch.points.length} puntos de la traza
            </Text>
          </View>
        ))}
      </View>
      <PageFooter section="espectro" trace={trace} />
    </Page>
  )
}

function ChecksAndSourcesPage({ trace }: { trace: CalculationTrace }) {
  const source = collectMemoriaSource(trace)
  const checks = selectRepresentativeBoundaryPoints(trace)
  return (
    <Page size="A4" style={styles.page} wrap>
      <RunningFrame section="comprobaciones" trace={trace} />
      <View style={styles.section}>
        <SectionTitle>Comprobaciones en fronteras de rama</SectionTitle>
        <Text style={styles.sectionIntro}>
          Se muestran únicamente las ordenadas representativas en puntos de control; el extremo gráfico de muestreo se omite deliberadamente.
        </Text>
        {checks.map(({ point, step }) => (
          <StepCard
            key={`${point.t}-${point.branch}`}
            step={{
              ...step,
              label: `Ordenada espectral en T = ${formatTraceNumber(point.t, 4)} s`,
            }}
          />
        ))}
      </View>

      <View style={styles.section}>
        <SectionTitle>Apéndice de fuentes</SectionTitle>
        <View style={styles.sourceItem} wrap={false}>
          <Text style={styles.sourceTitle}>Fuente primaria fijada</Text>
          <Text style={styles.sourceDetail}>{source.document}</Text>
          {source.sourceUrl ? <Text style={styles.sourceDetail}>{source.sourceUrl}</Text> : null}
          {source.pdfSha256 ? <Text style={styles.hash}>SHA-256: {source.pdfSha256}</Text> : null}
        </View>
        <View style={styles.sourceItem} wrap={false}>
          <Text style={styles.sourceTitle}>Parámetros municipales · evidencia con región verificable</Text>
          <Text style={styles.sourceDetail}>
            {source.appendix && source.municipalityPage
              ? `${source.appendix}; página impresa ${source.municipalityPrintedPage}; página PDF ${source.municipalityPage}. La evidencia mantiene coordenadas normalizadas de la fila y de Aa, Av, Ae y Ad.`
              : "No hay una cita municipal regionalizada asociada a esta traza."}
          </Text>
        </View>
        <View style={styles.sourceItem} wrap={false}>
          <Text style={styles.sourceTitle}>Referencias normativas emitidas por la traza</Text>
          <Text style={styles.sourceDetail}>{source.references.join(" · ")}</Text>
          <Text style={[styles.sourceDetail, { marginTop: 4 }]}>
            Para estas referencias se conserva el identificador normativo. Esta versión de la evidencia no declara páginas PDF regionalizadas adicionales; por ello no se atribuyen páginas no verificadas.
          </Text>
        </View>
        <View style={[styles.notice, { marginTop: 5 }]} wrap={false}>
          <Text style={styles.noticeTitle}>Lectura honesta de la evidencia</Text>
          <Text>
            La trazabilidad de cálculo demuestra reproducibilidad. La verificación independiente exige abrir la fuente primaria, revisar las disposiciones aplicables y confirmar los datos del proyecto.
          </Text>
        </View>
      </View>
    </Page>
  )
}

export function CalculationMemoriaDocument({ trace }: { trace: CalculationTrace }) {
  const municipality = trace.context.municipality?.name ?? "Sin municipio"
  return (
    <Document
      author="espectr0"
      creator="espectr0"
      keywords="NSR-10, espectro sísmico, memoria de cálculo, trazabilidad"
      subject={`Espectro elástico NSR-10 para ${municipality}`}
      title={`Memoria de cálculo · ${municipality}`}
    >
      <ExecutivePage trace={trace} />
      <InterpolationPage trace={trace} />
      <DerivedProofPage trace={trace} />
      <SpectrumPage trace={trace} />
      <ChecksAndSourcesPage trace={trace} />
    </Document>
  )
}

export async function renderCalculationMemoriaPdf(trace: CalculationTrace) {
  return pdf(<CalculationMemoriaDocument trace={trace} />).toBlob()
}

export async function downloadCalculationMemoriaPdf(trace: CalculationTrace) {
  const blob = await renderCalculationMemoriaPdf(trace)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = calculationMemoriaFilename(trace)
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
