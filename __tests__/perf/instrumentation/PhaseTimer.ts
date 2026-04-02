import { performance } from 'node:perf_hooks'

export class PhaseTimer {
  private readonly id: string

  constructor() {
    this.id = String(performance.now())
  }

  startPhase(name: string): void {
    performance.mark(this.markName(name, 'start'))
  }

  endPhase(name: string): void {
    performance.mark(this.markName(name, 'end'))
    performance.measure(
      this.measureName(name),
      this.markName(name, 'start'),
      this.markName(name, 'end')
    )
  }

  getTimings(): Record<string, number> {
    const entries = performance.getEntriesByType('measure')
    const prefix = `phase-${this.id}-`
    const timings: Record<string, number> = {}
    for (const entry of entries) {
      if (entry.name.startsWith(prefix)) {
        const phaseName = entry.name.slice(prefix.length)
        timings[phaseName] = entry.duration
      }
    }
    return timings
  }

  reset(): void {
    performance.clearMarks()
    performance.clearMeasures()
  }

  private markName(phase: string, point: string): string {
    return `phase-${this.id}-${phase}-${point}`
  }

  private measureName(phase: string): string {
    return `phase-${this.id}-${phase}`
  }
}
