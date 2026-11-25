import type { Intensity, Metric } from './index';
import type { SessionReport } from './session-report';

type NumericKey = {
  [Key in keyof TherapySettings]: TherapySettings[Key] extends number
    ? Key
    : never;
}[keyof TherapySettings];
type Option<Value extends string = string> = { label: string; value: Value };

interface FieldLabel {
  label: string;
  help?: string;
  customizesIntensity?: boolean;
}

export type TherapyField = FieldLabel &
  (
    | {
        kind: 'integer' | 'decimal';
        key: NumericKey;
        min: number;
        max: number;
        decimals: number;
      }
    | { kind: 'select'; key: 'intensity'; options: Option<Intensity>[] }
    | {
        kind: 'select';
        key: 'side';
        options: Option<TherapySettings['side']>[];
      }
    | {
        kind: 'list';
        key: 'targets';
        separator: ',';
        maxLength: number;
        placeholder: string;
      }
  );

export interface TherapySettings {
  intensity: Intensity;
  targets: string;
  durationSeconds: number;
  repetitions: number;
  holdSeconds: number;
  targetSeconds: number;
  tolerancePercent: number;
  postureTolerancePercent: number;
  pointsPerHit: number;
  side: 'left' | 'right';
  sets: number;
  restSeconds: number;
}
type Preset = Exclude<Intensity, 'custom'>;
export interface GameDefinition {
  label: string;
  posture: 'front' | 'side';
  postureLabel: string;
  help?: string;
  fields: readonly TherapyField[];
  defaults: TherapySettings;
  presets?: Record<Preset, Partial<TherapySettings>>;
  customIntensity: boolean;
  storedTargetsPattern: string;
  metrics?: readonly Metric[];
  defaultMetrics?: readonly Metric[];
  requiresSets?: boolean;
  independentHold?: boolean;
  report?: {
    movement: 'shoulderRepetitions' | 'lowerBody';
    attempts: 'timed' | 'fixed' | 'sets' | 'hitsOnly' | 'unscored';
  };
  historyScore?: (result: SessionReport) => string;
}

export const DEFAULT_GOALKEEPER_FLIGHT_MS = 2200;

export const NUMERIC_LIMITS: Record<NumericKey, readonly [number, number]> = {
  durationSeconds: [1, 3600],
  repetitions: [1, 1000],
  holdSeconds: [0, 3600],
  targetSeconds: [0.1, 3600],
  tolerancePercent: [1, 50],
  postureTolerancePercent: [0, 100],
  pointsPerHit: [0, 1000],
  sets: [1, 100],
  restSeconds: [0, 3600],
};

export function numberField(
  key: NumericKey,
  label: string,
  decimals = 0,
  customizesIntensity = true
): TherapyField {
  const [min, max] = NUMERIC_LIMITS[key];
  return {
    kind: decimals ? 'decimal' : 'integer',
    key,
    label,
    min,
    max,
    decimals,
    customizesIntensity,
  };
}

export const intensity: TherapyField = {
  key: 'intensity',
  kind: 'select',
  label: 'Intensidade',
  help: 'As intensidades preenchem sugestões que podem ser ajustadas ao paciente.',
  options: [
    { label: 'Personalizada', value: 'custom' },
    { label: 'Leve', value: 'low' },
    { label: 'Moderada', value: 'moderate' },
    { label: 'Alta', value: 'high' },
  ],
};

export const scoreFields = [
  numberField('tolerancePercent', 'Tolerância do alvo (%)'),
  numberField('postureTolerancePercent', 'Tolerância de postura (%)', 0, false),
  numberField('pointsPerHit', 'Pontos por acerto', 0, false),
];
export const timedFields = [
  numberField('durationSeconds', 'Duração ativa (s)'),
  numberField('holdSeconds', 'Permanência por alvo (s)', 1),
  numberField('repetitions', 'Repetições mínimas'),
  numberField('targetSeconds', 'Prazo por alvo (s)', 1),
  ...scoreFields,
];

export const commonDefaults: TherapySettings = {
  intensity: 'custom',
  targets: '',
  durationSeconds: 600,
  repetitions: 6,
  holdSeconds: 0.7,
  targetSeconds: 6,
  tolerancePercent: 12,
  postureTolerancePercent: 20,
  pointsPerHit: 10,
  side: 'left',
  sets: 1,
  restSeconds: 30,
};
export const timedPresets = {
  low: {
    durationSeconds: 600,
    repetitions: 4,
    holdSeconds: 0.5,
    targetSeconds: 8,
    tolerancePercent: 18,
  },
  moderate: {
    durationSeconds: 600,
    repetitions: 6,
    holdSeconds: 0.7,
    targetSeconds: 6,
    tolerancePercent: 12,
  },
  high: {
    durationSeconds: 600,
    repetitions: 10,
    holdSeconds: 1,
    targetSeconds: 4,
    tolerancePercent: 8,
  },
};
export const level = '(100|[0-9]{1,2}(\\.[0-9]{1,2})?)';
export const calibratedTargetHelp =
  'O jogo sorteia os alvos dentro do alcance calibrado para cada braço.';
export const frontActivity = {
  posture: 'front',
  postureLabel: 'De frente',
  customIntensity: false,
  storedTargetsPattern: '^$',
} as const;
