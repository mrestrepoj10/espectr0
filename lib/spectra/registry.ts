import {
  assertEngineResultIdentity,
  spectrumEngineMetadataSchema,
} from "./engine"
import { spectrumScenarioSchema } from "./types"

import type { SpectrumEngine } from "./engine"
import type { SpectrumScenario } from "./types"

/** Engine registry only; study activation remains an integration-layer decision. */
export class SpectrumEngineRegistry {
  readonly #engines = new Map<string, SpectrumEngine>()

  register(engine: SpectrumEngine): void {
    const metadata = spectrumEngineMetadataSchema.parse(engine.metadata)
    if (this.#engines.has(metadata.id)) {
      throw new Error(`Spectrum engine already registered: ${metadata.id}`)
    }
    this.#engines.set(metadata.id, engine)
  }

  get(engineId: string): SpectrumEngine | undefined {
    return this.#engines.get(engineId)
  }

  findForScenario(scenario: SpectrumScenario): SpectrumEngine | undefined {
    const parsed = spectrumScenarioSchema.parse(scenario)
    return [...this.#engines.values()].find((engine) => engine.accepts(parsed))
  }

  compute(engineId: string, scenario: SpectrumScenario) {
    const engine = this.#engines.get(engineId)
    if (!engine) throw new Error(`Unknown spectrum engine: ${engineId}`)
    const parsed = spectrumScenarioSchema.parse(scenario)
    const scenarioType = parsed.type
    if (!engine.accepts(parsed)) {
      throw new Error(`Engine ${engineId} does not accept ${scenarioType} scenarios`)
    }
    const result = engine.compute(parsed)
    assertEngineResultIdentity(engine.metadata, result)
    return result
  }

  list(): readonly SpectrumEngine[] {
    return [...this.#engines.values()]
  }
}
