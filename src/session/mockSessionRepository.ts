import type { SessionPlan, SessionRepository, SessionResult } from './types';

const plans: Record<string, SessionPlan> = {
  'QWER': { id: 'ritmo-suave', patientId: 'jogador-demo', displayName: 'Jogador demonstração', title: 'Ritmo dos ombros', targets: [{ left: 0.5, right: 0.5 }, { left: 0.8, right: 0.5 }, { left: 0.5, right: 0.8 }], repetitions: 6, holdMs: 700, beatMs: 6000 },
  'ASDF': { id: 'ritmo-alternado', patientId: 'jogador-demo', displayName: 'Jogador demonstração', title: 'Ritmo alternado', targets: [{ left: 0.4, right: 0.7 }, { left: 0.7, right: 0.4 }], repetitions: 4, holdMs: 700, beatMs: 5000 },
  'ZXCV': { id: 'ritmo-livre', patientId: 'jogador-demo', displayName: 'Jogador demonstração', title: 'Ritmo em dupla', targets: [{ left: 0.4, right: 0.4 }, { left: 0.7, right: 0.7 }, { left: 0.4, right: 0.7 }, { left: 0.7, right: 0.4 }], repetitions: 8, holdMs: 700, beatMs: 6000 },
};
const storageKey = 'virtualter.mock.session-results.v1';

/** Simula as operações do backend; os dados de exemplo e o histórico nunca saem do navegador. */
export class MockSessionRepository implements SessionRepository {
  async getPlanByCode(code: string): Promise<SessionPlan | null> {
    const key = code.trim().toUpperCase();
    const plan = Object.hasOwn(plans, key) ? plans[key] : undefined;
    return plan ? { ...plan, targets: plan.targets.map(target => ({ ...target })) } : null;
  }
  async listResults(patientId: string): Promise<SessionResult[]> {
    return this.read().filter(result => result.patientId === patientId).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }
  async saveResult(result: SessionResult): Promise<void> {
    const results = this.read().filter(item => item.id !== result.id);
    results.push(result);
    localStorage.setItem(storageKey, JSON.stringify(results));
  }
  private read(): SessionResult[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(value) ? value.filter((item): item is SessionResult =>
        item !== null && typeof item === 'object' && typeof item.id === 'string' &&
        typeof item.patientId === 'string' && typeof item.completedAt === 'string' &&
        typeof item.planTitle === 'string' && typeof item.completedTargets === 'number' &&
        typeof item.plannedTargets === 'number' && typeof item.durationSeconds === 'number') : [];
    } catch { return []; }
  }
}
