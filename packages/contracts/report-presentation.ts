import { GAME_DEFINITIONS } from './game-definitions';
import type { SessionReport } from './session-report';

export function reportLines(report: SessionReport): string[] {
  const { hits, misses, points, movement } = report;
  const score =
    GAME_DEFINITIONS[report.gameId]?.historyScore?.(report) ??
    `${hits} acertos · ${misses} erros · ${points} pontos`;
  const lines = score ? [score] : [];
  if (movement?.shoulderRepetitions) {
    const { left, right } = movement.shoulderRepetitions;
    lines.push(`Elevações do ombro · ${left} à esquerda, ${right} à direita`);
  }
  if (movement?.lowerBody) {
    const { kneeHeight, balance } = movement.lowerBody;
    lines.push(
      `Altura máxima (alcance calibrado) · ${kneeHeight.left}% à esquerda e ${kneeHeight.right}% à direita`,
      balance === null
        ? 'Equilíbrio sem leitura suficiente'
        : `Equilíbrio médio estimado · ${balance}%`
    );
  }
  return lines;
}
