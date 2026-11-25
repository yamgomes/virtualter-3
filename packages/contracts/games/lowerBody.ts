import type { GameDefinition } from '../game-definition';
import { commonDefaults, frontActivity, numberField } from '../game-definition';

const kneeMetrics = [
  'hits',
  'misses',
  'points',
  'activeMs',
  'pausedMs',
  'kneeHeight',
  'balance',
] as const;
const defaultKneeMetrics = [
  'hits',
  'activeMs',
  'kneeHeight',
  'balance',
] as const;

export const lowerBodyDefinitions = {
  kneeRaise: {
    ...frontActivity,
    metrics: kneeMetrics,
    defaultMetrics: defaultKneeMetrics,
    report: { movement: 'lowerBody', attempts: 'hitsOnly' },
    historyScore: ({ hits }) => `${hits} levantamentos`,
    label: 'Levantamento de joelhos',
    help: 'Eleve um joelho de cada vez e abaixe-o antes de repetir.',
    fields: [
      numberField('repetitions', 'Levantamentos mínimos'),
      numberField('durationSeconds', 'Tempo ativo (s)'),
    ],
    defaults: { ...commonDefaults, durationSeconds: 30 },
  },
  kneeJuggle: {
    ...frontActivity,
    metrics: kneeMetrics,
    defaultMetrics: defaultKneeMetrics,
    report: { movement: 'lowerBody', attempts: 'fixed' },
    historyScore: ({ hits, misses }) =>
      `${hits} toques · ${misses} bolas perdidas`,
    label: 'Embaixadinha de joelho',
    help: 'Eleve o joelho indicado quando a bola chegar à marca de contato.',
    fields: [
      numberField('repetitions', 'Quantidade de bolas'),
      numberField('targetSeconds', 'Tempo de queda da bola (s)', 1),
    ],
    defaults: {
      ...commonDefaults,
      repetitions: 8,
      targetSeconds: 2,
      holdSeconds: 0,
    },
  },
  walking: {
    ...frontActivity,
    metrics: ['activeMs', 'pausedMs', 'kneeHeight', 'balance'],
    defaultMetrics: ['activeMs', 'kneeHeight', 'balance'],
    report: { movement: 'lowerBody', attempts: 'unscored' },
    historyScore: () => '',
    label: 'Caminhada',
    help: 'Dê passos no lugar, alternando os pés, para caminhar pela faixa central.',
    fields: [numberField('durationSeconds', 'Tempo ativo (s)')],
    defaults: { ...commonDefaults, durationSeconds: 60 },
  },
} satisfies Record<string, GameDefinition>;
