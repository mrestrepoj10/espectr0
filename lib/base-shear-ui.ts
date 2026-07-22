import { baseShearConstants } from "./nsr10"

export const weightUnits = ["kn", "tonf", "kg"] as const

export type WeightUnit = (typeof weightUnits)[number]

export type EditableStory = {
  wx: number
  hx: number
}

export type StoryForceExportRow = EditableStory & {
  index: number
  cvx: number
  fx: number
  storyShear: number
}

function assertPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite number greater than zero`)
  }
}

export function weightToKn(value: number, unit: WeightUnit) {
  assertPositive(value, "Weight")
  if (unit === "kn") return value
  if (unit === "tonf") return value * baseShearConstants.gravityMps2
  return (value * baseShearConstants.gravityMps2) / 1_000
}

export function weightFromKn(valueKn: number, unit: WeightUnit) {
  assertPositive(valueKn, "Weight")
  if (unit === "kn") return valueKn
  if (unit === "tonf") return valueKn / baseShearConstants.gravityMps2
  return (valueKn * 1_000) / baseShearConstants.gravityMps2
}

export function convertWeight(
  value: number,
  from: WeightUnit,
  to: WeightUnit,
) {
  return weightFromKn(weightToKn(value, from), to)
}

export function createUniformStories(
  count: number,
  totalWeight: number,
  totalHeightM: number,
): EditableStory[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Story count must be a positive integer")
  }
  assertPositive(totalWeight, "Total weight")
  assertPositive(totalHeightM, "Total height")

  return Array.from({ length: count }, (_, index) => ({
    wx: totalWeight / count,
    hx: (totalHeightM * (index + 1)) / count,
  }))
}

export type StoryParseResult =
  | { ok: true; stories: EditableStory[] }
  | { ok: false; error: string }

function parseStoryLine(line: string) {
  const parts = line
    .trim()
    .split(/[\t;,]|\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length !== 2) return null
  const [wx, hx] = parts.map(Number)
  if (!Number.isFinite(wx) || !Number.isFinite(hx)) return null
  return { wx, hx }
}

export function parseStoryRows(text: string): StoryParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { ok: false, error: "Pega al menos una fila con peso y altura." }
  }

  const hasHeader = /[a-záéíóú]/i.test(lines[0])
  const dataLines = hasHeader ? lines.slice(1) : lines
  const stories = dataLines.map(parseStoryLine)

  if (stories.length === 0 || stories.some((story) => story === null)) {
    return {
      ok: false,
      error: "Cada fila debe contener exactamente dos números: wi y hi.",
    }
  }

  const parsedStories = stories as EditableStory[]
  for (let index = 0; index < parsedStories.length; index += 1) {
    const story = parsedStories[index]
    if (story.wx <= 0 || story.hx <= 0) {
      return { ok: false, error: "Los pesos y las alturas deben ser positivos." }
    }
    if (index > 0 && story.hx <= parsedStories[index - 1].hx) {
      return {
        ok: false,
        error: "Las alturas deben aumentar estrictamente desde la base.",
      }
    }
  }

  return { ok: true, stories: parsedStories }
}

export function storyForceCsv(rows: StoryForceExportRow[]) {
  const body = rows.map((row) =>
    [row.index + 1, row.wx, row.hx, row.cvx, row.fx, row.storyShear].join(","),
  )
  return ["Nivel,wi (kN),hi (m),Cvx,Fx (kN),V nivel (kN)", ...body].join(
    "\n",
  )
}
