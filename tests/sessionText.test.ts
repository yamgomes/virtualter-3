import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultTherapy } from '@homephysio/contracts';
import {
  planMetricsText,
  sessionSummary,
} from '../src/presentation/sessionText';
import { therapyPlan } from '../src/session/therapyPlan';
import { result } from './fixtures';

test('mantém o resumo de planos antigos e lê as repetições do resultado salvo', () => {
  assert.deepEqual(
    sessionSummary({
      ...result,
      movement: { shoulderRepetitions: { left: 2, right: 3 } },
    }),
    {
      title: 'Sessão encerrada por você.',
      details: [
        '1 acertos (meta mínima: 2)',
        '0 alvos não alcançados',
        '10 pontos',
        'Tempo ativo: 1 s',
        'Pausas: 0 s',
        'Elevações: 2 à esquerda, 3 à direita',
      ],
    }
  );
});

test('mostra as métricas na ordem prescrita e calcula o que faltou para a meta', () => {
  const therapy = defaultTherapy('kneeRaise');
  therapy.metrics = ['balance', 'kneeHeight', 'misses'];
  const plan = therapyPlan(result.patientId, 1, therapy);
  assert.equal(
    planMetricsText(plan.metrics),
    'equilíbrio estimado, altura dos joelhos, alvos não alcançados'
  );
  const summary = sessionSummary({
    ...result,
    plan,
    plannedAttempts: therapy.repetitions,
    endReason: 'completed',
    movement: {
      lowerBody: { kneeHeight: { left: 65, right: 85 }, balance: 0 },
    },
  });
  assert.equal(summary.title, 'Você concluiu sua sessão.');
  assert.deepEqual(summary.details, [
    'Equilíbrio médio estimado: 0%',
    'Altura máxima (alcance calibrado): 65% à esquerda e 85% à direita',
    `${therapy.repetitions - result.hits} levantamentos faltaram para a meta`,
  ]);
});
