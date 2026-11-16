import { isSessionResult } from './types';
import type { SessionPlan, SessionRepository, SessionResult } from './types';

const identity = {
  version: 1,
  patientId: 'jogador-demo',
  displayName: 'Jogador demonstração',
};
const plans: Record<string, SessionPlan> = {
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
export const RESULTS_KEY = 'virtualter.mock.session-results.v2';
/** Dados fictícios. O histórico v1 permanece intacto sob sua chave anterior. */
export class MockSessionRepository implements SessionRepository {
  async getPlanByCode(code: string): Promise<SessionPlan | null> {
    const key = code.trim().toUpperCase();
    return Object.hasOwn(plans, key) ? structuredClone(plans[key]) : null;
  }
  async listResults(patientId: string): Promise<SessionResult[]> {
    return this.read()
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }
  async saveResult(result: SessionResult): Promise<void> {
    if (!isSessionResult(result)) throw new Error('Resultado inválido');
    const results = this.read().filter((r) => r.id !== result.id);
    results.push(result);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
  }
  private read(): SessionResult[] {
    const data: unknown = JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '[]');
    if (!Array.isArray(data) || !data.every(isSessionResult))
      throw new Error('Histórico local inválido; os dados foram preservados.');
    return data;
  }
}

