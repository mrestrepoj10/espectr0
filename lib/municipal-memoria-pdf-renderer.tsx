import {
  Document,
  Line,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer"

import { normalizePdfText } from "./memoria-pdf"
import { resolveSpectrumEvidence } from "./spectra/evidence"

import type {
  NormalizedSpectrumResultData,
  SpectrumEvidenceView,
} from "./spectra"

type SuccessfulResult = Extract<NormalizedSpectrumResultData, { status: "ok" }>

const palette = {
  ink: "#172033",
  muted: "#5E687A",
  line: "#E3E7EF",
  panel: "#F6F8FB",
  blue: "#245EDB",
  blueSoft: "#EAF0FF",
  amber: "#8B5709",
  amberSoft: "#FFF5DF",
  green: "#176B45",
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    color: palette.ink,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    lineHeight: 1.42,
    paddingBottom: 48,
    paddingHorizontal: 42,
    paddingTop: 48,
  },
  header: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    color: palette.muted,
    fontSize: 7,
    left: 42,
    paddingBottom: 7,
    position: "absolute",
    right: 42,
    top: 22,
  },
  footer: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    color: palette.muted,
    fontSize: 7,
    left: 42,
    paddingTop: 7,
    position: "absolute",
    right: 42,
    textAlign: "right",
    top: 812,
  },
  eyebrow: {
    color: palette.blue,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 7,
    textTransform: "uppercase",
  },
  title: { fontSize: 23, fontWeight: 700, lineHeight: 1.12, marginBottom: 7 },
  subtitle: { color: palette.muted, fontSize: 10, marginBottom: 16 },
  section: { marginBottom: 15 },
  sectionTitle: {
    borderBottomColor: palette.blue,
    borderBottomWidth: 1.5,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
    paddingBottom: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 4,
    borderWidth: 1,
    padding: 8,
    width: "31.8%",
  },
  metricLabel: { color: palette.muted, fontSize: 7, marginBottom: 3 },
  metricValue: { fontSize: 13, fontWeight: 700 },
  notice: {
    backgroundColor: palette.amberSoft,
    borderColor: "#E9CE8F",
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 8,
    padding: 8,
  },
  noticeTitle: { color: palette.amber, fontWeight: 700, marginBottom: 2 },
  card: {
    borderColor: palette.line,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 7,
    padding: 8,
  },
  cardTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 3 },
  detail: { color: palette.muted, fontSize: 7.5 },
  equation: {
    backgroundColor: palette.panel,
    borderRadius: 3,
    fontFamily: "Courier",
    fontSize: 7.5,
    marginTop: 4,
    padding: 5,
  },
  sourceCard: {
    backgroundColor: palette.blueSoft,
    borderColor: "#CAD8FF",
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 7,
    padding: 8,
  },
  hash: { color: palette.muted, fontFamily: "Courier", fontSize: 6 },
  chart: {
    borderColor: palette.line,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 10,
    padding: 8,
  },
  branchRow: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
  },
  branchName: { fontFamily: "Courier", fontSize: 7.5, width: "23%" },
  branchFormula: { width: "48%" },
  branchRange: { color: palette.muted, textAlign: "right", width: "29%" },
  citationId: { color: palette.blue, fontFamily: "Courier", fontSize: 6.5 },
})

function clean(value: unknown) {
  return normalizePdfText(String(value ?? ""))
}

function number(value: number, digits = 6) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value)
}

export function formatMunicipalReturnPeriod(returnPeriodYears: number | null) {
  return returnPeriodYears === null
    ? "período de retorno no declarado"
    : `${returnPeriodYears} años`
}

function numericText(value: string) {
  return clean(value).replace(/\d+\.\d{7,}/g, (match) =>
    Number.parseFloat(match).toLocaleString("es-CO", {
      maximumFractionDigits: 6,
      useGrouping: false,
    }),
  )
}

function Frame({ section }: { section: string }) {
  return (
    <>
      <Text fixed style={styles.header}>espectr0 · memoria contextual municipal · {clean(section)}</Text>
      <Text
        fixed
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        style={styles.footer}
      />
    </>
  )
}

function SpectrumPlot({ result }: { result: SuccessfulResult }) {
  const width = 490
  const height = 220
  const pad = 28
  const maxT = Math.max(...result.points.map(({ tSeconds }) => tSeconds), 1)
  const maxSa = Math.max(...result.points.map(({ saG }) => saG), 1e-9)
  const x = (t: number) => pad + (t / maxT) * (width - pad * 2)
  const y = (sa: number) => height - pad - (sa / maxSa) * (height - pad * 2)
  const path = result.points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.tSeconds).toFixed(2)} ${y(point.saG).toFixed(2)}`)
    .join(" ")
  return (
    <View style={styles.chart}>
      <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
        <Line stroke={palette.line} strokeWidth={1} x1={pad} x2={pad} y1={pad} y2={height - pad} />
        <Line stroke={palette.line} strokeWidth={1} x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} />
        <Path d={path} fill="none" stroke={palette.blue} strokeWidth={2.2} />
        <Text x={pad} y={16} style={{ fill: palette.muted, fontSize: 7 }}>Sa (g)</Text>
        <Text x={width - 43} y={height - 9} style={{ fill: palette.muted, fontSize: 7 }}>T (s)</Text>
        <Text x={pad - 2} y={height - 14} style={{ fill: palette.muted, fontSize: 6 }}>0</Text>
        <Text x={width - 42} y={height - 14} style={{ fill: palette.muted, fontSize: 6 }}>{number(maxT, 2)}</Text>
        <Text x={pad + 2} y={pad - 6} style={{ fill: palette.muted, fontSize: 6 }}>{number(maxSa, 3)}</Text>
      </Svg>
      <Text style={styles.detail}>Curva dibujada exclusivamente con las {result.points.length} ordenadas normalizadas exportadas; el PDF no recalcula Sa(T).</Text>
    </View>
  )
}

function SummaryPage({ result, evidence }: { result: SuccessfulResult; evidence: SpectrumEvidenceView }) {
  return (
    <Page size="A4" style={styles.page}>
      <Frame section="resumen" />
      <Text style={styles.eyebrow}>Memoria reproducible · estudio municipal</Text>
      <Text style={styles.title}>{clean(evidence.study.label)}</Text>
      <Text style={styles.subtitle}>
        {clean(evidence.selection.zone ? `Zona ${evidence.selection.zone}` : "Zona no declarada")} · {clean(result.hazard.label)} · {formatMunicipalReturnPeriod(result.hazard.returnPeriodYears)} · amortiguamiento {number(result.hazard.dampingRatio * 100)} %
      </Text>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Selección manual y alcance</Text>
        <Text>{clean("Esta memoria conserva el resultado normalizado y sus citas. No usa mapas, coordenadas, GIS ni selección automática de zona.")}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parámetros principales</Text>
        <View style={styles.grid}>
          {result.metrics.slice(0, 9).map((metric) => (
            <View key={metric.id} style={styles.metric}>
              <Text style={styles.metricLabel}>{clean(metric.label)}</Text>
              <Text style={styles.metricValue}>{number(metric.value)} {clean(metric.unit)}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advertencias normativas</Text>
        {result.warnings.map((warning) => (
          <View key={warning.code} style={styles.card} wrap={false}>
            <Text style={styles.cardTitle}>{clean(warning.code)}</Text>
            <Text>{clean(warning.message)}</Text>
            <Text style={styles.citationId}>{clean(warning.citationIds.join(", "))}</Text>
          </View>
        ))}
      </View>
    </Page>
  )
}

function LineagePage({ evidence }: { evidence: SpectrumEvidenceView }) {
  return (
    <Page size="A4" style={styles.page}>
      <Frame section="valores y linaje" />
      <Text style={styles.sectionTitle}>Valores directos de fuente</Text>
      {evidence.directValues.map((value) => (
        <View key={value.id} style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>{clean(value.label)} = {clean(value.value)} {clean(value.unit)}</Text>
          <Text style={styles.detail}>Paso de traza: {clean(value.traceStepId)} · cita {clean(value.citationId)}</Text>
        </View>
      ))}
      <Text style={styles.sectionTitle}>Métricas derivadas</Text>
      {evidence.metricLineage.map((metric) => (
        <View key={metric.id} style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>{clean(metric.label)} = {number(metric.value)} {clean(metric.unit)}</Text>
          <Text style={styles.detail}>{clean(metric.reference ?? "Referencia incluida en la cita")}</Text>
          {metric.formula ? <Text style={styles.equation}>{clean(metric.formula)}</Text> : null}
          {metric.substitution ? <Text style={styles.equation}>{numericText(metric.substitution)}</Text> : null}
          <Text style={styles.citationId}>{clean(metric.citationIds.join(", "))}</Text>
        </View>
      ))}
    </Page>
  )
}

function SpectrumPage({ result, evidence }: { result: SuccessfulResult; evidence: SpectrumEvidenceView }) {
  return (
    <Page size="A4" style={styles.page}>
      <Frame section="espectro" />
      <Text style={styles.sectionTitle}>Espectro normalizado</Text>
      <SpectrumPlot result={result} />
      <Text style={styles.sectionTitle}>Ramas activas dentro del dominio aplicable</Text>
      {evidence.branchLineage.map((branch) => (
        <View key={branch.branchId} style={styles.branchRow} wrap={false}>
          <Text style={styles.branchName}>{clean(branch.branchId)}</Text>
          <View style={styles.branchFormula}>
            <Text>{clean(branch.formula ?? branch.formulaId)}</Text>
            <Text style={styles.detail}>{clean(branch.condition ?? "")}</Text>
          </View>
          <Text style={styles.branchRange}>{number(branch.periodRangeSeconds.from, 3)}–{number(branch.periodRangeSeconds.to, 3)} s · {branch.pointCount} puntos</Text>
        </View>
      ))}
    </Page>
  )
}

function CitationCards({ citations }: { citations: SpectrumEvidenceView["citations"] }) {
  return citations.map((citation) => (
    <View key={citation.id} style={styles.card} wrap={false}>
      <Text style={styles.citationId}>{clean(citation.id)}</Text>
      <Text style={styles.cardTitle}>{clean(citation.reference)}</Text>
      <Text style={styles.detail}>PDF {citation.physicalPage} · impresa {clean(citation.printedPage ?? "N/A")} · {clean(citation.sourceId)}</Text>
      <Text>{clean(citation.transcription)}</Text>
    </View>
  ))
}

function SourcesPages({ evidence }: { evidence: SpectrumEvidenceView }) {
  const firstCitations = evidence.citations.slice(0, 4)
  const remainingCitations = evidence.citations.slice(4)
  const continuationChunks = Array.from(
    { length: Math.ceil(remainingCitations.length / 5) },
    (_, index) => remainingCitations.slice(index * 5, index * 5 + 5),
  )
  return (
    <>
      <Page size="A4" style={styles.page}>
        <Frame section="fuentes y citas" />
        <Text style={styles.sectionTitle}>Documentos declarados</Text>
        {evidence.documents.map((document) => (
          <View key={document.sourceId} style={styles.sourceCard} wrap={false}>
            <Text style={styles.cardTitle}>{clean(document.title)}</Text>
            <Text style={styles.detail}>{clean(document.issuingAuthority)} · {clean(document.edition)}</Text>
            <Text style={styles.detail}>{clean(document.adoptionInstrument)}</Text>
            <Text style={styles.hash}>SHA-256 {document.sha256}</Text>
            <Text style={styles.citationId}>{clean(document.sourceUrl)}</Text>
          </View>
        ))}
        <Text style={styles.sectionTitle}>Regiones citadas</Text>
        <CitationCards citations={firstCitations} />
      </Page>
      {continuationChunks.map((citations, index) => (
        <Page key={`citations-${index}`} size="A4" style={styles.page}>
          <Frame section={`fuentes y citas · continuación ${index + 1}`} />
          <Text style={styles.sectionTitle}>Regiones citadas · continuación</Text>
          <CitationCards citations={citations} />
        </Page>
      ))}
    </>
  )
}

export function MunicipalMemoriaDocument({ result }: { result: SuccessfulResult }) {
  const evidence = resolveSpectrumEvidence(result)
  return (
    <Document
      author="espectr0"
      creator="espectr0"
      subject="Memoria contextual de espectro sísmico municipal"
      title={`Memoria contextual · ${evidence.study.label}`}
    >
      <SummaryPage evidence={evidence} result={result} />
      <LineagePage evidence={evidence} />
      <SpectrumPage evidence={evidence} result={result} />
      <SourcesPages evidence={evidence} />
    </Document>
  )
}

export async function renderMunicipalMemoriaPdf(result: NormalizedSpectrumResultData) {
  if (result.status !== "ok") {
    throw new Error("Municipal contextual PDF requires an applicable result")
  }
  return pdf(<MunicipalMemoriaDocument result={result} />).toBlob()
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function municipalMemoriaFilename(result: NormalizedSpectrumResultData) {
  const option = result.scenarioEvidenceKey.optionId ?? result.study.id
  const hazard = result.scenarioEvidenceKey.hazardId ?? "sin-amenaza"
  return `espectr0-memoria-${slug(result.study.id)}-${slug(option)}-${slug(hazard)}.pdf`
}
