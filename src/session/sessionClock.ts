/** Relógio da sessão: intervalos sem duas leituras válidas contam como pausa. */
export class SessionClock {
  private started: number;
  private last: number;
  private wasActive = false;
  private active = 0;
  constructor(now: number) {
    this.started = now;
    this.last = now;
  }
  tick(now: number, active: boolean): void {
    if (!Number.isFinite(now) || now < this.last) return;
    const delta = now - this.last;
    if (active && this.wasActive && delta <= 500) this.active += delta;
    this.last = now;
    this.wasActive = active;
  }
  snapshot() {
    return {
      durationMs: this.last - this.started,
      activeMs: this.active,
      pausedMs: this.last - this.started - this.active,
    };
  }
}
