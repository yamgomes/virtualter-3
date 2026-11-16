import type { ShoulderValues } from './automaticCalibration';
export interface ShoulderGameConfig { targets: readonly ShoulderValues[]; repetitions: number; holdMs: number; beatMs: number; tolerance?: number }
export type ShoulderGameEvent = { type: 'hit' | 'miss'; completed: number; hits: number; points: number } | { type: 'completed'; completed: number; hits: number; points: number };

/** Cada batida avalia os dois braços ao mesmo tempo; perda de pose pausa o relógio. */
export class ShoulderGame {
  readonly tolerance: number;
  readonly config: ShoulderGameConfig;
  private lastUpdate: number | null = null;
  private heldMs = 0;
  private wasMatching = false;
  private elapsed = 0;
  private count = 0;
  private hitCount = 0;
  private done = false;
  constructor(config: ShoulderGameConfig) {
    this.config = config;
    if (!config.targets.length || config.targets.some(t => ![t.left, t.right].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) || !Number.isInteger(config.repetitions) || config.repetitions < 1 || !Number.isFinite(config.holdMs) || config.holdMs < 0 || !Number.isFinite(config.beatMs) || config.beatMs <= 0 || config.holdMs > config.beatMs || (config.tolerance !== undefined && (!Number.isFinite(config.tolerance) || config.tolerance <= 0 || config.tolerance > 0.5))) throw new Error('Configuração do jogo inválida');
    this.tolerance = config.tolerance ?? 0.12;
  }
  get target(): ShoulderValues { return this.config.targets[this.count % this.config.targets.length]; }
  get completed(): number { return this.count; }
  get hits(): number { return this.hitCount; }
  get points(): number { return this.hitCount * 10; }
  get remainingMs(): number { return Math.max(0, this.config.beatMs - this.elapsed); }
  update(value: ShoulderValues | null, now: number): ShoulderGameEvent[] {
    if (this.done || !value || !Number.isFinite(value.left) || !Number.isFinite(value.right) || !Number.isFinite(now)) { this.heldMs = 0; this.wasMatching = false; this.lastUpdate = null; return []; }
    const delta = this.lastUpdate === null ? 0 : now - this.lastUpdate;
    this.lastUpdate = now;
    if (delta < 0 || delta > 500) { this.heldMs = 0; this.wasMatching = false; return []; }
    const step = Math.min(delta, this.config.beatMs - this.elapsed);
    this.elapsed += step;
    const matches = Math.abs(value.left - this.target.left) <= this.tolerance && Math.abs(value.right - this.target.right) <= this.tolerance;
    this.heldMs = matches && this.wasMatching ? this.heldMs + step : 0;
    this.wasMatching = matches;
    if (this.elapsed < this.config.beatMs) return [];
    const success = matches && this.heldMs >= this.config.holdMs;
    if (success) this.hitCount++;
    this.count++; this.elapsed = 0; this.heldMs = 0; this.wasMatching = false;
    const event: ShoulderGameEvent = { type: success ? 'hit' : 'miss', completed: this.count, hits: this.hits, points: this.points };
    if (this.count >= this.config.repetitions) { this.done = true; return [event, { type: 'completed', completed: this.count, hits: this.hits, points: this.points }]; }
    return [event];
  }
}
