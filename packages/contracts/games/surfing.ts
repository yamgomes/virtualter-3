import type { GameDefinition } from '../game-definition';
import {
  commonDefaults,
  intensity,
  level,
  timedFields,
  timedPresets,
} from '../game-definition';

export const surfingDefinitions = {
  surfing: {
    label: 'Surfe',
    report: { movement: 'none', attempts: 'timed' },
    posture: 'side',
    postureLabel: 'De lado',
    fields: [
      intensity,
      {
        key: 'targets',
        kind: 'list',
        label: 'Alvos em %',
        help: 'Separe os valores por vírgula.',
        separator: ',',
        maxLength: 500,
        placeholder: '30,70,20,60',
        customizesIntensity: true,
      },
      {
        key: 'side',
        kind: 'select',
        label: 'Lado voltado à câmera',
        options: [
          { label: 'Esquerdo', value: 'left' },
          { label: 'Direito', value: 'right' },
        ],
      },
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
} satisfies Record<string, GameDefinition>;
