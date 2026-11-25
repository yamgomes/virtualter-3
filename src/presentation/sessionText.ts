import { METRICS } from '@homephysio/contracts';
import type { Metric } from '@homephysio/contracts';
import { gamePlans } from '../games/planRegistry';
import type { SessionResult } from '../session/types';

const hitLabel = 'acertos';

const legacyMetrics: readonly Metric[] = [
  'hits',
  'misses',
  'points',
  'activeMs',
  'pausedMs',
];
const summaryTitles: Record<SessionResult['endReason'], string> = {
  completed: 'Você concluiu sua sessão.',
  error: 'A sessão encontrou um erro.',
  stopped: 'Sessão encerrada por você.',
};

export function planMetricsText(metrics?: readonly Metric[]): string {
  if (!metrics?.length) return '';
  const labels = metrics.map((metric) =>
    metric === 'hits'
      ? hitLabel
      : METRICS.find(({ value }) => value === metric)?.label.toLocaleLowerCase(
          'pt-BR'
        )
  );
  return labels.join(', ');
}

export function sessionSummary(result: SessionResult): {
  title: string;
  details: string[];
} {
  const { gameId, metrics } = result.plan;
  const { summary } = gamePlans[gameId];
  const { kneeHeight, balance } = result.movement?.lowerBody ?? {};
  const repetitions = result.movement?.shoulderRepetitions;
  const summaries: Record<Metric, string> = {
    hits:
      summary?.hits?.(result) ??
      `${result.hits} ${hitLabel} (meta mínima: ${result.plannedAttempts})`,
    misses:
      summary?.misses?.(result) ?? `${result.misses} alvos não alcançados`,
    points: `${result.points} pontos`,
    activeMs: `Tempo ativo: ${Math.round(result.activeMs / 1000)} s`,
    pausedMs: `Pausas: ${Math.round(result.pausedMs / 1000)} s`,
    kneeHeight: kneeHeight
      ? `Altura máxima (alcance calibrado): ${kneeHeight.left}% à esquerda e ${kneeHeight.right}% à direita`
      : 'Altura dos joelhos indisponível',
    balance:
      balance == null
        ? 'Equilíbrio sem leitura suficiente'
        : `Equilíbrio médio estimado: ${balance}%`,
  };
  const details = (metrics ?? legacyMetrics).map((metric) => summaries[metric]);
  if (repetitions)
    details.push(
      `Elevações: ${repetitions.left} à esquerda, ${repetitions.right} à direita`
    );
  return {
    title: summaryTitles[result.endReason],
    details,
  };
}
