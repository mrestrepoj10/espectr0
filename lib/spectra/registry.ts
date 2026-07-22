import type { SpectrumEngine } from "./engine"
import type { SpectrumScenario } from "./types"

/** Engine registry only; study activation remains an integration-layer decision. */
export class SpectrumEngineRegistry {
  readonly #engines = new Map<string, SpectrumEngine>()

  register(engine: SpectrumEngine): void {
    if (this.#engines.has(engine.metadata.id)) {
      throw new Error(`Spectrum engine already registered: ${engine.metadata.id}`)
    }
    this.#engines.set(engine.metadata.id, engine)
  }

  get(engineId: string): SpectrumEngine | undefined {
    return this.#engines.get(engineId)
  }

  findForScenario(scenario: SpectrumScenario): SpectrumEngine | undefined {
    return [...this.#engines.values()].find((engine) => engine.accepts(scenario))
  }

  list(): readonly SpectrumEngine[] {
    return [...this.#engines.values()]
  }
}
