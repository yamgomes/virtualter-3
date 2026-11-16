export type GameId = 'shoulder' | 'surfing';
export type Metric = 'hits' | 'misses' | 'points' | 'activeMs' | 'pausedMs';
export type Intensity = 'low' | 'moderate' | 'high' | 'custom';
export interface Therapy {
  gameId: GameId; title: string; intensity: Intensity; metrics: Metric[];
  targets: string; durationSeconds: number; repetitions: number; holdSeconds: number;
  targetSeconds: number; tolerancePercent: number; postureTolerancePercent: number;
  pointsPerHit: number; side: 'left' | 'right';
}
export interface Patient {
  id: string; name: string; code: string; therapy: Therapy | null; revision: number;
}
export const METRICS: { value: Metric; label: string }[] = [
  { value: 'hits', label: 'Acertos / repetições' }, { value: 'misses', label: 'Alvos não alcançados' },
  { value: 'points', label: 'Pontuação' }, { value: 'activeMs', label: 'Tempo ativo' }, { value: 'pausedMs', label: 'Tempo em pausa' },
];
export function defaultTherapy(): Therapy {
  return { gameId: 'shoulder', title: 'Semáforo', intensity: 'custom', metrics: ['hits', 'activeMs'],
    targets: '50/50,80/50,50/80', durationSeconds: 60, repetitions: 6, holdSeconds: 0.7,
    targetSeconds: 6, tolerancePercent: 12, postureTolerancePercent: 20, pointsPerHit: 10, side: 'left' };
}
// Intensidade é uma sugestão de parâmetros do protótipo, não uma dose clínica validada.
export function intensityPreset(value: Exclude<Intensity, 'custom'>, game: GameId): Partial<Therapy> {
  const high = value === 'high', low = value === 'low';
  return { intensity: value, durationSeconds: low ? 30 : high ? 90 : 60, repetitions: low ? 4 : high ? 10 : 6,
    holdSeconds: low ? 0.5 : high ? 1 : 0.7, targetSeconds: low ? 8 : high ? 4 : 6,
    tolerancePercent: low ? 18 : high ? 8 : 12,
    targets: game === 'shoulder' ? (low ? '30/30,50/30,30/50' : high ? '60/60,80/60,60/80' : '50/50,70/50,50/70') : (low ? '30,50,30,50' : high ? '60,80,60,80' : '40,70,40,70') };
}
const level = '(100|[0-9]{1,2}(\\.[0-9]{1,2})?)';
export function validTherapy(t: unknown): t is Therapy {
  if (!t || typeof t !== 'object') return false;
  const v = t as Therapy;
  const bounded = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  return ['shoulder', 'surfing'].includes(v.gameId) && typeof v.title === 'string' && v.title.trim().length > 0 && v.title.length <= 120 &&
    ['low','moderate','high','custom'].includes(v.intensity) && Array.isArray(v.metrics) && v.metrics.length > 0 && v.metrics.length <= 5 && new Set(v.metrics).size === v.metrics.length && v.metrics.every(m => METRICS.some(x => x.value === m)) &&
    typeof v.targets === 'string' && v.targets.length <= 500 && new RegExp(v.gameId === 'shoulder' ? `^${level}/${level}(,${level}/${level})*$` : `^${level}(,${level})*$`).test(v.targets) &&
    bounded(v.durationSeconds,1,3600) && bounded(v.repetitions,1,1000) && Number.isInteger(v.repetitions) && bounded(v.holdSeconds,0,3600) && bounded(v.targetSeconds,0.1,3600) && v.holdSeconds <= v.targetSeconds &&
    bounded(v.tolerancePercent,1,50) && bounded(v.postureTolerancePercent,0,100) && bounded(v.pointsPerHit,0,1000) && Number.isInteger(v.pointsPerHit) && ['left','right'].includes(v.side);
}
export function normalizeCode(code: string): string { return code.replace(/[\s-]/g, '').toUpperCase(); }
const CODE_ALPHABET = '235789BCDEFHJKMNPQRSTUVWXYZ';
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{6}$`);
export function validCode(code: string): boolean { return CODE_PATTERN.test(code); }
export function validIssuedCode(code: string): boolean { return /^[2-9A-HJ-NP-Z]{6}$/.test(code); }
export function createCode(): string {
  const limit = 256 - 256 % CODE_ALPHABET.length;
  let code = '';
  while (code.length < 6) {
    for (const byte of crypto.getRandomValues(new Uint8Array(6))) {
      if (byte < limit) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === 6) break;
    }
  }
  return code;
}
export function displayCode(code: string): string { return code; }
export const FIREBASE_CONFIG = { projectId: 'homephysio-virtualter', appId: '1:103403442423:web:3ca980868a72dd620203f2', apiKey: 'AIzaSyDS3mn_hGEaOnqm8SXwmNpF67UTN5HBgBE', authDomain: 'homephysio-virtualter.firebaseapp.com' };
