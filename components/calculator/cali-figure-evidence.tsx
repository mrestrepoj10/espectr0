"use client"

import { ExternalLinkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  caliComponentLabel,
  caliLegendZoneBand,
  caliMapEvidence,
} from "@/lib/cali"

const DECREE_URL =
  "https://www.cali.gov.co/aplicaciones/boletin_publicaciones/imagenes_documentos/documentoId7429.pdf"

/**
 * The cut of the INGEOMINAS sheet behind the selected zone: the thematic legend
 * with that zone's row highlighted, the sheet it was read from, and the sheet's
 * own coefficient table. The coefficients the calculator uses come from the
 * adopting decree, cited cell by cell; this panel is how the engineer checks
 * the one thing a citation cannot back — that the site falls in this zone.
 */
export function CaliFigureEvidence({
  componentId,
}: {
  componentId: string | null
}) {
  if (!componentId) return null
  const band = caliLegendZoneBand(componentId)
  const { source } = caliMapEvidence

  return (
    <section
      aria-labelledby="cali-figure-evidence"
      className="flex flex-col gap-4"
      data-slot="cali-figure-evidence"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading font-medium" id="cali-figure-evidence">
          Evidencia cartográfica de la zona
        </h2>
        <Badge variant="outline">{caliComponentLabel(componentId)}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        {source.title} · {source.issuingAuthority} · {source.date} · escala{" "}
        {source.scale}. Los coeficientes que aplica la calculadora salen de las
        Tablas 2 a 4 del Decreto 411.0.20.0158 de 2014; esta hoja muestra dónde
        queda la zona seleccionada.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
        <figure className="flex flex-col gap-1">
          <div className="relative overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Leyenda temática de las diez zonas de respuesta de Cali"
              className="w-full"
              src={caliMapEvidence.legendImage}
            />
            <div
              aria-hidden="true"
              className="absolute rounded-[2px] border-2 border-amber-500 bg-amber-400/25"
              style={{
                left: `${band.left * 100}%`,
                top: `${band.top * 100}%`,
                width: `${band.width * 100}%`,
                height: `${band.height * 100}%`,
              }}
            />
          </div>
          <figcaption className="text-muted-foreground text-xs">
            Leyenda impresa; fila resaltada: {caliComponentLabel(componentId)}.
          </figcaption>
        </figure>

        <figure className="flex flex-col gap-1">
          <div className="overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Plancha MZSC-R02, microzonificación sísmica de Santiago de Cali"
              className="w-full"
              src={caliMapEvidence.image}
            />
          </div>
          <figcaption className="text-muted-foreground text-xs">
            Hoja completa. SHA-256 {source.sha256.slice(0, 16)}…
          </figcaption>
        </figure>
      </div>

      <figure className="flex flex-col gap-1">
        <div className="overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Tabla de coeficientes espectrales de diseño impresa en la plancha MZSC-R02"
            className="w-full"
            src={caliMapEvidence.coefficientTableImage}
          />
        </div>
        <figcaption className="text-muted-foreground text-xs">
          La plancha imprime sus propios coeficientes. Tc y TL coinciden con el
          decreto en doce de las trece combinaciones zona-componente; la zona 4C
          en su componente TL difiere (2,0 s en la plancha, 2,10 s en el
          decreto) y gobierna el decreto adoptado.
        </figcaption>
      </figure>

      <Button
        className="self-start"
        nativeButton={false}
        render={<a href={DECREE_URL} rel="noreferrer" target="_blank" />}
        size="sm"
        variant="outline"
      >
        Abrir el Decreto 0158 de 2014
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
    </section>
  )
}
