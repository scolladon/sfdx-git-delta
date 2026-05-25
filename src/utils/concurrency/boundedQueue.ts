'use strict'

type Worker<T> = (item: T) => Promise<void>

type Resolver = () => void
type Rejecter = (reason: unknown) => void

export class BoundedQueue<T> {
  protected readonly pending: T[] = []
  protected active = 0
  protected error: unknown = undefined
  protected readonly drainResolvers: Resolver[] = []
  protected readonly drainRejecters: Rejecter[] = []

  constructor(
    protected readonly worker: Worker<T>,
    protected readonly limit: number
  ) {}

  public push(item: T): void {
    if (this.error !== undefined) return
    this.pending.push(item)
    this._pump()
  }

  public idle(): boolean {
    return this.active === 0 && this.pending.length === 0
  }

  public drain(): Promise<void> {
    if (this.error !== undefined) return Promise.reject(this.error)
    if (this.idle()) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      this.drainResolvers.push(resolve)
      this.drainRejecters.push(reject)
    })
  }

  private _pump(): void {
    while (this.active < this.limit && this.pending.length > 0) {
      const item = this.pending.shift() as T
      this.active++
      void this._run(item)
    }
  }

  private async _run(item: T): Promise<void> {
    try {
      await this.worker(item)
    } catch (err: unknown) {
      this._fail(err)
      return
    } finally {
      this.active--
    }
    if (this.idle()) this._resolveAllDrainWaiters()
    else this._pump()
  }

  private _fail(err: unknown): void {
    if (this.error !== undefined) return
    this.error = err
    this.pending.length = 0
    const rejecters = this.drainRejecters.splice(0)
    this.drainResolvers.length = 0
    for (const reject of rejecters) reject(err)
  }

  private _resolveAllDrainWaiters(): void {
    const resolvers = this.drainResolvers.splice(0)
    this.drainRejecters.length = 0
    for (const resolve of resolvers) resolve()
  }
}
