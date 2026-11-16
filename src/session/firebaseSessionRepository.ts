import { initializeApp, getApps } from 'firebase/app';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG, normalizeCode, validIssuedCode, validTherapy } from '@homephysio/contracts';
import type { Therapy } from '@homephysio/contracts';
import type { SessionPlan, SessionRepository, SessionResult } from './types';
import { MockSessionRepository } from './mockSessionRepository';

export function therapyPlan(patientId: string, revision: number, t: Therapy): SessionPlan {
  const config = { repetitions: t.repetitions, holdMs: t.holdSeconds * 1000, timeLimitMs: t.targetSeconds * 1000,
    tolerance: t.tolerancePercent / 100, sessionDurationMs: t.durationSeconds * 1000, pointsPerHit: t.pointsPerHit,
    posture: { mode: t.gameId === 'shoulder' ? 'front' as const : 'side' as const, tolerance: t.postureTolerancePercent / 100 } };
  const identity = { id: patientId, patientId, version: revision, displayName: 'Paciente', title: t.title, metrics: t.metrics, intensity: t.intensity };
  return t.gameId === 'shoulder' ? { ...identity, gameId: 'shoulder', config }
    : { ...identity, gameId: 'surfing', config: { ...config, targets: t.targets.split(',').map(n => Number(n) / 100), side: t.side } };
}

/** O código é uma credencial somente de leitura. Nenhuma conta de paciente é criada. */
export class FirebaseSessionRepository implements SessionRepository {
  private db = getFirestore(getApps()[0] ?? initializeApp(FIREBASE_CONFIG));
  private local = new MockSessionRepository();
  private loaded: { code: string; patientId: string; revision: number } | null = null;
  async getPlanByCode(input: string): Promise<SessionPlan | null> {
    this.loaded = null;
    const code = normalizeCode(input);
    if (!validIssuedCode(code)) return null;
    try {
      const snapshot = await getDocFromServer(doc(this.db, 'patientAccess', code));
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      if (data['revoked'] === true) return null;
      if (typeof data['patientId'] !== 'string' || !Number.isInteger(data['revision']) || data['revision'] < 1 || !validTherapy(data['therapy'])) throw Error('Terapia inválida. Entre em contato com seu fisioterapeuta.');
      this.loaded = { code, patientId: data['patientId'], revision: data['revision'] };
      return therapyPlan(data['patientId'], data['revision'], data['therapy']);
    } catch (error) {
      if ((error as { code?: string }).code === 'permission-denied') return null;
      throw Error('Não foi possível consultar a terapia. Verifique a conexão e tente novamente.');
    }
  }
  async validateAccess(plan: SessionPlan): Promise<boolean> {
    const loaded = this.loaded;
    if (!loaded || loaded.patientId !== plan.patientId || loaded.revision !== plan.version) return false;
    const snapshot = await getDocFromServer(doc(this.db, 'patientAccess', loaded.code));
    return snapshot.exists() && snapshot.data()['revision'] === loaded.revision;
  }
  listResults(patientId: string): Promise<SessionResult[]> { return this.local.listResults(patientId); }
  saveResult(result: SessionResult): Promise<void> { return this.local.saveResult(result); }
}
