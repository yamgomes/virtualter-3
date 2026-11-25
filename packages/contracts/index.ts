import { GAME_DEFINITIONS, NUMERIC_LIMITS } from './game-definitions';
import type { TherapySettings } from './game-definitions';
import type { lowerBodyDefinitions } from './games/lowerBody';
export {
  DEFAULT_GOALKEEPER_FLIGHT_MS,
  GAME_DEFINITIONS,
} from './game-definitions';
export type {
  GameDefinition,
  TherapyField,
  TherapySettings,
} from './game-definitions';
export { reportLines } from './report-presentation';
export { validMovementMetrics } from './session-report';
export type {
  LowerBodyMetrics,
  MovementMetrics,
  ShoulderRepetitions,
  SessionReport,
} from './session-report';

export type LowerBodyGameId = keyof typeof lowerBodyDefinitions;
export type GameId = keyof typeof GAME_DEFINITIONS;
export function isGameId(value: unknown): value is GameId {
  return typeof value === 'string' && Object.hasOwn(GAME_DEFINITIONS, value);
}
export type Metric =
  | 'hits'
  | 'misses'
  | 'points'
  | 'activeMs'
  | 'pausedMs'
  | 'kneeHeight'
  | 'balance';
export type Intensity = 'low' | 'moderate' | 'high' | 'custom';
export interface Therapy extends TherapySettings {
  gameId: GameId;
  title: string;
  metrics: Metric[];
}
export interface Patient {
  id: string;
  name: string;
  code: string;
  therapy: Therapy | null;
  revision: number;
}
export const METRICS: { value: Metric; label: string }[] = [
  { value: 'hits', label: 'Acertos / repetições' },
  { value: 'misses', label: 'Alvos não alcançados' },
  { value: 'points', label: 'Pontuação' },
  { value: 'activeMs', label: 'Tempo ativo' },
  { value: 'pausedMs', label: 'Tempo em pausa' },
  { value: 'kneeHeight', label: 'Altura dos joelhos' },
  { value: 'balance', label: 'Equilíbrio estimado' },
];
export function metricsForGame(game: GameId) {
  const available = GAME_DEFINITIONS[game].metrics ?? commonMetrics;
  return METRICS.filter(({ value }) => available.includes(value));
}
const commonMetrics: readonly Metric[] = [
  'hits',
  'misses',
  'points',
  'activeMs',
  'pausedMs',
];
export function defaultTherapy(gameId: GameId = 'shoulder'): Therapy {
  const {
    label,
    defaults,
    defaultMetrics = ['hits', 'activeMs'],
  } = GAME_DEFINITIONS[gameId];
  const metrics = [...defaultMetrics];
  return { ...defaults, gameId, title: label, metrics };
}
// Intensidade é uma sugestão de parâmetros do protótipo, não uma dose clínica validada.
export function intensityPreset(
  value: Exclude<Intensity, 'custom'>,
  game: GameId
): Partial<Therapy> {
  return { ...GAME_DEFINITIONS[game].presets?.[value], intensity: value };
}
export function validTherapy(t: unknown): t is Therapy {
  if (!t || typeof t !== 'object') return false;
  const v = t as Therapy;
  if (!isGameId(v.gameId)) return false;
  const definition = GAME_DEFINITIONS[v.gameId];
  const metrics = metricsForGame(v.gameId);
  const numbersValid = (
    Object.keys(NUMERIC_LIMITS) as (keyof typeof NUMERIC_LIMITS)[]
  ).every((key) => {
    const [min, max] = NUMERIC_LIMITS[key];
    const value =
      v[key] ?? (key === 'sets' ? 1 : key === 'restSeconds' ? 0 : undefined);
    return Number.isFinite(value) && value >= min && value <= max;
  });
  return (
    typeof v.title === 'string' &&
    v.title.trim().length > 0 &&
    v.title.length <= 120 &&
    ['low', 'moderate', 'high', 'custom'].includes(v.intensity) &&
    Array.isArray(v.metrics) &&
    v.metrics.length > 0 &&
    v.metrics.length <= metrics.length &&
    new Set(v.metrics).size === v.metrics.length &&
    v.metrics.every((m) => metrics.some((x) => x.value === m)) &&
    typeof v.targets === 'string' &&
    v.targets.length <= 500 &&
    new RegExp(definition.storedTargetsPattern).test(v.targets) &&
    numbersValid &&
    (!definition.requiresSets ||
      (Number.isInteger(v.sets) && v.sets >= 1 && v.restSeconds >= 0)) &&
    (definition.independentHold || v.holdSeconds <= v.targetSeconds) &&
    Number.isInteger(v.repetitions) &&
    Number.isInteger(v.pointsPerHit) &&
    ['left', 'right'].includes(v.side)
  );
}
export function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}
const CODE_ALPHABET = '235789BCDEFHJKMNPQRSTUVWXYZ';
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{6}$`);
export function validCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}
export function validIssuedCode(code: string): boolean {
  return /^[2-9A-HJ-NP-Z]{6}$/.test(code);
}
export function createCode(): string {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = '';
  while (code.length < 6) {
    for (const byte of crypto.getRandomValues(new Uint8Array(6))) {
      if (byte < limit) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === 6) break;
    }
  }
  return code;
}
export function displayCode(code: string): string {
  return code;
}
export const FIREBASE_CONFIG = {
  projectId: 'homephysio-virtualter',
  appId: '1:103403442423:web:3ca980868a72dd620203f2',
  apiKey: 'AIzaSyDS3mn_hGEaOnqm8SXwmNpF67UTN5HBgBE',
  authDomain: 'homephysio-virtualter.firebaseapp.com',
};
