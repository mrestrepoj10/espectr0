import {
  assertEngineResultIdentity,
  spectrumEngineMetadataSchema,
} from "./engine"
import { spectrumScenarioSchema } from "./types"

import type { SpectrumEngine } from "./engine"
import type { SpectrumScenario } from "./types"

type RegisteredEngine = {
  engine: SpectrumEngine
  metadata: ReturnType<typeof spectrumEngineMetadataSchema.parse>
}

function scenarioMatchesMetadata(
  scenario: SpectrumScenario,
  metadata: RegisteredEngine["metadata"],
): boolean {
  return (
    scenario.type === metadata.scenarioType &&
    scenario.studyId === metadata.studyId &&
    scenario.studyVersion === metadata.studyVersion
  )
}

function assertScenarioMatchesMetadata(
  scenario: SpectrumScenario,
  metadata: RegisteredEngine["metadata"],
): void {
  if (!scenarioMatchesMetadata(scenario, metadata)) {
    throw new Error(
      `Scenario ${scenario.type}/${scenario.studyId}/${scenario.studyVersion} does not match registered engine metadata ${metadata.scenarioType}/${metadata.studyId}/${metadata.studyVersion}`,
    )
  }
}

/** Engine registry only; study activation remains an integration-layer decision. */
export class SpectrumEngineRegistry {
  readonly #engines = new Map<string, RegisteredEngine>()

  register(engine: SpectrumEngine): void {
    const metadata = spectrumEngineMetadataSchema.parse(engine.metadata)
    if (this.#engines.has(metadata.id)) {
      throw new Error(`Spectrum engine already registered: ${metadata.id}`)
    }
    this.#engines.set(metadata.id, { engine, metadata })
  }

  get(engineId: string): SpectrumEngine | undefined {
    return this.#engines.get(engineId)?.engine
  }

  findForScenario(scenario: SpectrumScenario): SpectrumEngine | undefined {
    const parsed = spectrumScenarioSchema.parse(scenario)
    return [...this.#engines.values()]
      .find(
        ({ engine, metadata }) =>
          scenarioMatchesMetadata(parsed, metadata) && engine.accepts(parsed),
      )
      ?.engine
  }

  compute(engineId: string, scenario: SpectrumScenario) {
    const registration = this.#engines.get(engineId)
    if (!registration) throw new Error(`Unknown spectrum engine: ${engineId}`)
    const { engine, metadata } = registration
    const parsed = spectrumScenarioSchema.parse(scenario)
    const scenarioType: string = parsed.type
    assertScenarioMatchesMetadata(parsed, metadata)
    if (!engine.accepts(parsed)) {
      throw new Error(`Engine ${engineId} does not accept ${scenarioType} scenarios`)
    }
    const result = engine.compute(parsed)
    assertEngineResultIdentity(metadata, result)
    return result
  }

  list(): readonly SpectrumEngine[] {
    return [...this.#engines.values()].map(({ engine }) => engine)
  }
}
