"use client"

import { ExternalLinkIcon, ShieldAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  medellinLegendZoneBand,
  medellinMapEvidence,
  medellinZoneLabel,
} from "@/lib/medellin"

/**
 * The cut of the POT sheet behind the selected zone. The coefficients come from
 * the DAP support table, cited cell by cell; this panel backs the one thing a
 * citation cannot — that the site falls in this zone.
 */
export function MedellinFigureEvidence({ zoneId }: { zoneId: string | null }) {
  if (!zoneId) return null
  const band = medellinLegendZoneBand(zoneId)
  const { source } = medellinMapEvidence

  return (
    <section
      aria-labelledby="medellin-figure-evidence"
      className="flex flex-col gap-4"
      data-slot="medellin-figure-evidence"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading font-medium" id="medellin-figure-evidence">
          Evidencia cartográfica de la zona
        </h2>
        <Badge variant="outline">{medellinZoneLabel(zoneId)}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        {source.title} · {source.issuingAuthority}. Los coeficientes provienen
        del soporte técnico DAP de 2011; esta plancha muestra dónde queda la zona
        seleccionada.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <figure className="flex flex-col gap-1">
          <div className="relative overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Convención de las catorce zonas homogéneas de Medellín"
              className="w-full"
              src={medellinMapEvidence.legendImage}
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
            Convención impresa; fila resaltada: {medellinZoneLabel(zoneId)}.
          </figcaption>
        </figure>

        <figure className="flex flex-col gap-1">
          <div className="overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Plancha del POT con las zonas homogéneas de Medellín"
              className="w-full"
              src={medellinMapEvidence.image}
            />
          </div>
          <figcaption className="text-muted-foreground text-xs">
            Hoja completa. SHA-256 {source.sha256.slice(0, 16)}…
          </figcaption>
        </figure>
      </div>

      <Alert>
        <ShieldAlertIcon />
        <AlertTitle>La fila se empareja por posición, no por rótulo</AlertTitle>
        <AlertDescription>
          {medellinMapEvidence.rowMatchingNote} Verifica el rótulo contra la
          plancha antes de firmar.
        </AlertDescription>
      </Alert>

      {source.mirrorUrl ? (
        <Button
          className="self-start"
          nativeButton={false}
          render={<a href={source.mirrorUrl} rel="noreferrer" target="_blank" />}
          size="sm"
          variant="outline"
        >
          Abrir la plancha completa
          <ExternalLinkIcon data-icon="inline-end" />
        </Button>
      ) : null}
    </section>
  )
}
