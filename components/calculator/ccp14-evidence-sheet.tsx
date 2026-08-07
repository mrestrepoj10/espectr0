"use client"

import { ExternalLinkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  ccp14CityReading,
  ccp14FigurePosition,
  ccp14LegendRowBand,
  ccp14LegendValue,
  ccp14MapFigure,
  type Ccp14Coefficient,
} from "@/lib/ccp14"

const SECTION3_URL =
  "https://www.invias.gov.co/loader.php?lServicio=Tools2&lTipo=descargas&lFuncion=descargar&idFile=29584"

const COEFFICIENTS: Ccp14Coefficient[] = ["PGA", "Ss", "S1"]

const VERIFICATION_LABEL: Record<string, string> = {
  confirmed: "Confirmada por revisión",
  agrees: "Segunda lectura coincide",
  unverified: "Sin segunda lectura",
  disputed: "En disputa",
}

function decimals(value: number) {
  return value.toFixed(2).replace(".", ",")
}

/**
 * The cut of the official figure behind one coefficient: the legend row that
 * states the value, and the point on the map the region was read at. Both are
 * available as soon as a location is picked, before anything is calculated.
 */
function FigureEvidence({
  coefficient,
  locationId,
  region,
}: {
  coefficient: Ccp14Coefficient
  locationId: string
  region: number
}) {
  const figure = ccp14MapFigure(coefficient)
  const band = ccp14LegendRowBand(coefficient, region)
  const position = ccp14FigurePosition(coefficient, locationId)
  const figureName = figure.id.replace("figura-", "Figura ")

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">
          {coefficient} = {decimals(ccp14LegendValue(coefficient, region))} g
        </h3>
        <span className="text-muted-foreground text-xs">
          {figureName} · PDF {figure.physicalPage} · impresa {figure.printedPage}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <figure className="flex flex-col gap-1">
          <div className="relative overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`Leyenda Región/${coefficient} de la ${figureName}`}
              className="w-full"
              src={figure.legendImage}
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
            Leyenda impresa; fila resaltada: región {region}.
          </figcaption>
        </figure>

        <figure className="flex flex-col gap-1">
          <div className="relative overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${figureName}, mapa de valores ${coefficient}`}
              className="w-full"
              src={figure.image}
            />
            {position ? (
              <span
                aria-hidden="true"
                className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-500 bg-amber-400/40"
                style={{
                  left: `${position.x * 100}%`,
                  top: `${position.y * 100}%`,
                }}
              />
            ) : null}
          </div>
          <figcaption className="text-muted-foreground text-xs">
            {position?.from === "plotted-dot"
              ? "Punto rotulado en la figura oficial."
              : "Posición estimada con la retícula; la figura no dibuja punto aquí."}
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

export function Ccp14EvidenceSheet({
  locationId,
  onOpenChange,
  open,
}: {
  locationId: string | null
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const reading = ccp14CityReading(locationId)

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="w-full gap-0 overflow-y-auto sm:max-w-3xl"
        side="right"
      >
        <SheetHeader>
          <SheetTitle>Evidencia de la lectura del mapa</SheetTitle>
          <SheetDescription>
            Recortes de las figuras oficiales que respaldan PGA, Ss y S1 antes de
            calcular.
          </SheetDescription>
        </SheetHeader>

        {reading && locationId ? (
          <div className="flex flex-col gap-6 px-4 pb-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{reading.label}</span>
              <Badge variant="outline">
                {VERIFICATION_LABEL[reading.pgaVerification] ??
                  reading.pgaVerification}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              El valor de cada región lo publica la leyenda de su figura. La
              asignación lugar-a-región es una lectura de mapa hecha por espectr0,
              no un dato publicado por INVÍAS: verifícala contra la figura y edita
              el valor si difiere. {reading.note}
            </p>

            {COEFFICIENTS.map((coefficient) => (
              <FigureEvidence
                coefficient={coefficient}
                key={coefficient}
                locationId={locationId}
                region={reading.regions[coefficient]}
              />
            ))}

            <Button
              nativeButton={false}
              render={<a href={SECTION3_URL} rel="noreferrer" target="_blank" />}
              size="sm"
              variant="outline"
            >
              Abrir la Sección 3 oficial de INVÍAS
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground px-4 pb-8 text-sm">
            Selecciona un lugar rotulado en los mapas para ver su evidencia.
          </p>
        )}
      </SheetContent>
    </Sheet>
  )
}
