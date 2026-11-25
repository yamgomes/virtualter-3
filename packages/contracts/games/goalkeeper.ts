import type { GameDefinition } from '../game-definition';
import {
  calibratedTargetHelp,
  commonDefaults,
  DEFAULT_GOALKEEPER_FLIGHT_MS,
  numberField,
  scoreFields,
} from '../game-definition';

export const goalkeeperDefinitions = {
  goalkeeper: {
    report: { movement: 'shoulderRepetitions', attempts: 'fixed' },
    historyScore: ({ hits, misses, points }) =>
      `${hits} defesas · ${misses} gols sofridos · ${points} pontos`,
    label: 'Goleiro',
    posture: 'front',
    postureLabel: 'De frente',
    help: calibratedTargetHelp,
    fields: [
      {
        key: 'intensity',
        kind: 'select',
        label: 'Intensidade',
        help: 'No nível 3, o próximo chute aguarda se já houver duas bolas no ar.',
        options: [
          { label: '1 · Pausa de 1 s após cada chute', value: 'low' },
          {
            label: '2 · Próximo chute assim que a bola chega',
            value: 'moderate',
          },
          { label: '3 · Novo chute a cada 0,5 s', value: 'high' },
        ],
      },
      numberField('repetitions', 'Quantidade de chutes'),
      numberField('targetSeconds', 'Tempo de voo da bola (s)', 1),
      ...scoreFields,
    ],
    defaults: {
      ...commonDefaults,
      intensity: 'low',
      repetitions: 8,
      holdSeconds: 0,
      targetSeconds: DEFAULT_GOALKEEPER_FLIGHT_MS / 1000,
      tolerancePercent: 18,
    },
    customIntensity: false,
    storedTargetsPattern: '^$',
  },
} satisfies Record<string, GameDefinition>;
