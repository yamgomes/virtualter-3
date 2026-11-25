import type { GameDefinition } from '../game-definition';
import {
  calibratedTargetHelp,
  commonDefaults,
  intensity,
  level,
  numberField,
  timedFields,
  timedPresets,
} from '../game-definition';

export const shoulderDefinitions = {
  shoulder: {
    report: { movement: 'shoulderRepetitions', attempts: 'timed' },
    label: 'Semáforo',
    posture: 'front',
    postureLabel: 'De frente',
    help: calibratedTargetHelp,
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
  shoulderElevation: {
    report: { movement: 'shoulderRepetitions', attempts: 'sets' },
    independentHold: true,
    requiresSets: true,
    label: 'Elevação de ombros convencional',
    posture: 'front',
    postureLabel: 'De frente',
    help: 'Enquadre os dois ombros, cotovelos e quadris. Eleve os dois braços ao mesmo tempo, até a altura confortável definida na calibração.',
    fields: [
      numberField('repetitions', 'Repetições por série'),
      numberField('holdSeconds', 'Tempo mínimo no alto (s)', 1),
      numberField('sets', 'Número de séries'),
      numberField('restSeconds', 'Descanso entre séries (s)', 0, false),
    ],
    defaults: {
      ...commonDefaults,
      targets: '',
      repetitions: 8,
      holdSeconds: 1,
      targetSeconds: 6,
      sets: 3,
      restSeconds: 30,
    },
    customIntensity: false,
    storedTargetsPattern: '^$',
  },
} satisfies Record<string, GameDefinition>;
