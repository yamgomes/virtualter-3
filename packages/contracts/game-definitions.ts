import type { GameId, Intensity, Therapy } from './index';

type NumericKey = {
  [Key in keyof Therapy]: Therapy[Key] extends number ? Key : never;
}[keyof Therapy];
type Option<Value extends string = string> = { label: string; value: Value };

interface FieldLabel {
  label: string;
  help?: string;
  customizesIntensity?: boolean;
}

export type TherapyField = FieldLabel & (
  | { kind: 'integer' | 'decimal'; key: NumericKey; min: number; max: number; decimals: number }
  | { kind: 'select'; key: 'intensity'; options: Option<Intensity>[] }
  | { kind: 'select'; key: 'side'; options: Option<Therapy['side']>[] }
  | { kind: 'list'; key: 'targets'; separator: ','; maxLength: number; placeholder: string }
);

type Settings = Omit<Therapy, 'gameId' | 'title' | 'metrics'>;
type Preset = Exclude<Intensity, 'custom'>;
interface GameDefinition {
  label: string;
  posture: 'front' | 'side';
  postureLabel: string;
  help?: string;
  fields: readonly TherapyField[];
  defaults: Settings;
  presets?: Record<Preset, Partial<Settings>>;
  customIntensity: boolean;
  storedTargetsPattern: string;
}

export const DEFAULT_GOALKEEPER_FLIGHT_MS = 1000;

export const NUMERIC_LIMITS: Record<NumericKey, readonly [number, number]> = {
  durationSeconds: [1, 3600],
  repetitions: [1, 1000],
  holdSeconds: [0, 3600],
  targetSeconds: [0.1, 3600],
  tolerancePercent: [1, 50],
  postureTolerancePercent: [0, 100],
  pointsPerHit: [0, 1000],
};

function numberField(key: NumericKey, label: string, decimals = 0, customizesIntensity = true): TherapyField {
  const [min, max] = NUMERIC_LIMITS[key];
  return { kind: decimals ? 'decimal' : 'integer', key, label, min, max, decimals, customizesIntensity };
}

const intensity: TherapyField = {
  key: 'intensity', kind: 'select', label: 'Intensidade',
  help: 'As intensidades preenchem sugestões que podem ser ajustadas ao paciente.',
  options: [
    { label: 'Personalizada', value: 'custom' }, { label: 'Leve', value: 'low' },
    { label: 'Moderada', value: 'moderate' }, { label: 'Alta', value: 'high' },
  ],
};

const scoreFields = [
  numberField('tolerancePercent', 'Tolerância do alvo (%)'),
  numberField('postureTolerancePercent', 'Tolerância de postura (%)', 0, false),
  numberField('pointsPerHit', 'Pontos por acerto', 0, false),
];
const timedFields = [
  numberField('durationSeconds', 'Duração ativa (s)'),
  numberField('holdSeconds', 'Permanência por alvo (s)', 1),
  numberField('repetitions', 'Repetições mínimas'),
  numberField('targetSeconds', 'Prazo por alvo (s)', 1),
  ...scoreFields,
];

const commonDefaults: Settings = {
  intensity: 'custom', targets: '', durationSeconds: 60, repetitions: 6, holdSeconds: 0.7,
  targetSeconds: 6, tolerancePercent: 12, postureTolerancePercent: 20, pointsPerHit: 10, side: 'left',
};
const timedPresets = {
  low: { durationSeconds: 30, repetitions: 4, holdSeconds: 0.5, targetSeconds: 8, tolerancePercent: 18 },
  moderate: { durationSeconds: 60, repetitions: 6, holdSeconds: 0.7, targetSeconds: 6, tolerancePercent: 12 },
  high: { durationSeconds: 90, repetitions: 10, holdSeconds: 1, targetSeconds: 4, tolerancePercent: 8 },
};
const level = '(100|[0-9]{1,2}(\\.[0-9]{1,2})?)';
const calibratedTargetHelp = 'O jogo sorteia os alvos dentro do alcance calibrado para cada braço.';

export const GAME_DEFINITIONS: Record<GameId, GameDefinition> = {
  shoulder: {
    label: 'Semáforo', posture: 'front', postureLabel: 'De frente', help: calibratedTargetHelp,
    fields: [intensity, ...timedFields],
    defaults: { ...commonDefaults, targets: '50/50,80/50,50/80' },
    presets: {
      low: { ...timedPresets.low, targets: '30/30,50/30,30/50' },
      moderate: { ...timedPresets.moderate, targets: '50/50,70/50,50/70' },
      high: { ...timedPresets.high, targets: '60/60,80/60,60/80' },
    },
    customIntensity: true,
    storedTargetsPattern: `^${level}/${level}(,${level}/${level})*$`,
  },
  surfing: {
    label: 'Surfe', posture: 'side', postureLabel: 'De lado',
    fields: [
      intensity,
      { key: 'targets', kind: 'list', label: 'Alvos em %', help: 'Separe os valores por vírgula.', separator: ',', maxLength: 500, placeholder: '30,70,20,60', customizesIntensity: true },
      { key: 'side', kind: 'select', label: 'Lado voltado à câmera', options: [{ label: 'Esquerdo', value: 'left' }, { label: 'Direito', value: 'right' }] },
      ...timedFields,
    ],
    defaults: { ...commonDefaults, targets: '30,70,20,60' },
    presets: {
      low: { ...timedPresets.low, targets: '30,50,30,50' },
      moderate: { ...timedPresets.moderate, targets: '40,70,40,70' },
      high: { ...timedPresets.high, targets: '60,80,60,80' },
    },
    customIntensity: true,
    storedTargetsPattern: `^${level}(,${level})*$`,
  },
  goalkeeper: {
    label: 'Goleiro', posture: 'front', postureLabel: 'De frente', help: calibratedTargetHelp,
    fields: [
      { key: 'intensity', kind: 'select', label: 'Intensidade', help: 'No nível 3, o próximo chute aguarda se já houver duas bolas no ar.', options: [
        { label: '1 · Pausa de 1 s após cada chute', value: 'low' },
        { label: '2 · Próximo chute assim que a bola chega', value: 'moderate' },
        { label: '3 · Novo chute a cada 0,5 s', value: 'high' },
      ] },
      numberField('repetitions', 'Quantidade de chutes'),
      numberField('targetSeconds', 'Tempo de voo da bola (s)', 1),
      ...scoreFields,
    ],
    defaults: { ...commonDefaults, intensity: 'low', repetitions: 8, holdSeconds: 0, targetSeconds: DEFAULT_GOALKEEPER_FLIGHT_MS / 1000, tolerancePercent: 18 },
    customIntensity: false,
    storedTargetsPattern: '^$',
  },
};
