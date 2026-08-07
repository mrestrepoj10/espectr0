"use client"

import { ExternalLinkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  bogotaLegendRowBand,
  bogotaMapEvidence,
  bogotaZoneLabel,
} from "@/lib/bogota"

const MAP_URL =
  "https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=40984"

/**
 * The cut of the official annex map behind the selected zone: the legend with
 * that zone's swatch highlighted, and the sheet it was read from. Shown in the
 * one traceability drawer next to the tabulated coefficients it explains.
 */
export function BogotaFigureEvidence({ zoneId }: { zoneId: string | null }) {
  if (!zoneId) return null
  const band = bogotaLegendRowBand(zoneId)
  const { source } = bogotaMapEvidence

  return (
    <section
      aria-labelledby="bogota-figure-evidence"
      className="flex flex-col gap-4"
      data-slot="bogota-figure-evidence"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading font-medium" id="bogota-figure-evidence">
          Evidencia cartográfica de la zona
        </h2>
        <Badge variant="outline">{bogotaZoneLabel(zoneId)}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        {source.title} · {source.issuingAuthority} · {source.date} · escala{" "}
        {source.scale}. Los coeficientes de la zona provienen de la Tabla 7.5 del
        informe FOPAE; esta hoja muestra dónde queda la zona seleccionada.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <figure className="flex flex-col gap-1">
          <div className="relative overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Leyenda de zonas de respuesta sísmica del Mapa No 2"
              className="w-full"
              src={bogotaMapEvidence.legendImage}
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 border-y-2 border-amber-500 bg-amber-400/25"
              style={{
                top: `${band.top * 100}%`,
                height: `${band.height * 100}%`,
              }}
            />
          </div>
          <figcaption className="text-muted-foreground text-xs">
            Leyenda impresa; fila resaltada: {bogotaZoneLabel(zoneId)}.
          </figcaption>
        </figure>

        <figure className="flex flex-col gap-1">
          <div className="overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Mapa No 2, zonas de respuesta sísmica de Bogotá D.C."
              className="w-full"
              src={bogotaMapEvidence.image}
            />
          </div>
          <figcaption className="text-muted-foreground text-xs">
            Hoja completa del anexo cartográfico. SHA-256{" "}
            {source.sha256.slice(0, 16)}…; la hoja no tiene aún una URL oficial
            registrada, así que verifica el anexo contra el decreto antes de
            firmar.
          </figcaption>
        </figure>
      </div>

      <Button
        className="self-start"
        nativeButton={false}
        render={<a href={MAP_URL} rel="noreferrer" target="_blank" />}
        size="sm"
        variant="outline"
      >
        Abrir el Decreto 523 de 2010
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
    </section>
  )
}
