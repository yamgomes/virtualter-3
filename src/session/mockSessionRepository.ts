import { DEFAULT_GOALKEEPER_FLIGHT_MS } from '@homephysio/contracts';
import type { SessionPlan } from './types';

const identity = {
  version: 1,
  patientId: 'jogador-demo',
  displayName: 'Jogador demonstração',
};
const plans: Record<string, SessionPlan> = {
  GOOL: {
    ...identity,
    id: 'goleiro-demo',
    title: 'Defenda o gol',
    gameId: 'goalkeeper',
    config: {
      repetitions: 8,
      timeLimitMs: DEFAULT_GOALKEEPER_FLIGHT_MS,
      tolerance: 0.18,
      pointsPerHit: 10,
    },
  },
  QWER: {
    ...identity,
    id: 'ritmo-suave',
    title: 'Semáforo',
    gameId: 'shoulder',
    config: {
      sessionDurationMs: 60000,
      pointsPerHit: 10,
      repetitions: 6,
      holdMs: 700,
      timeLimitMs: 6000,
      tolerance: 0.12,
    },
  },
  ASDF: {
    ...identity,
    id: 'ritmo-alternado',
    title: 'Semáforo · menos tempo por alvo',
    gameId: 'shoulder',
    config: {
      sessionDurationMs: 60000,
      pointsPerHit: 10,
      repetitions: 4,
      holdMs: 700,
      timeLimitMs: 5000,
      tolerance: 0.12,
    },
  },
  ZXCV: {
    ...identity,
    id: 'ritmo-livre',
    title: 'Semáforo · mais repetições',
    gameId: 'shoulder',
    config: {
      sessionDurationMs: 60000,
      pointsPerHit: 10,
      repetitions: 8,
      holdMs: 700,
      timeLimitMs: 6000,
      tolerance: 0.12,
    },
  },
  SURF: {
    ...identity,
    id: 'surfe-esquerdo',
    title: 'Surfe por inclinação',
    gameId: 'surfing',
    config: {
      side: 'left',
      targets: [0.3, 0.7, 0.2, 0.6],
      sessionDurationMs: 60000,
      pointsPerHit: 10,
      repetitions: 6,
      holdMs: 700,
      timeLimitMs: 7000,
      tolerance: 0.14,
    },
  },
  ONDA: {
    ...identity,
    id: 'surfe-direito',
    title: 'Surfe pelo lado direito',
    gameId: 'surfing',
    config: {
      side: 'right',
      targets: [0.3, 0.7, 0.2, 0.6],
      sessionDurationMs: 60000,
      pointsPerHit: 10,
      repetitions: 6,
      holdMs: 700,
      timeLimitMs: 7000,
      tolerance: 0.14,
    },
  },
};
/** Planos fictícios usados na demonstração e nos testes. */
export class MockSessionRepository {
  async getPlanByCode(code: string): Promise<SessionPlan | null> {
    const key = code.trim().toUpperCase();
    return Object.hasOwn(plans, key) ? structuredClone(plans[key]) : null;
  }
}
