import { initializeApp, getApps } from 'firebase/app';
import { doc, getDocFromServer, getFirestore, setDoc } from 'firebase/firestore';
import { FIREBASE_CONFIG, normalizeCode, validIssuedCode, validTherapy } from '@homephysio/contracts';
import type { SessionPlan, SessionRepository, SessionResult } from './types';
import { MockSessionRepository } from './mockSessionRepository';
import { therapyPlan } from './therapyPlan';
import type { SessionReport } from '@homephysio/contracts';

/** O código permite carregar a terapia e enviar seu resultado. */
export class FirebaseSessionRepository implements SessionRepository {
  private db = getFirestore(getApps()[0] ?? initializeApp(FIREBASE_CONFIG));
  private local = new MockSessionRepository();
  private loaded: { code: string; ownerId: string; patientId: string; revision: number } | null = null;
  async getPlanByCode(input: string): Promise<SessionPlan | null> {
    this.loaded = null;
    const code = normalizeCode(input);
    if (code === 'GOOL') return this.local.getPlanByCode(code);
    if (!validIssuedCode(code)) return null;
    try {
      const snapshot = await getDocFromServer(doc(this.db, 'patientAccess', code));
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      if (data['revoked'] === true) return null;
      if (typeof data['ownerId'] !== 'string' || typeof data['patientId'] !== 'string' || !Number.isInteger(data['revision']) || data['revision'] < 1 || !validTherapy(data['therapy'])) throw Error('Terapia inválida. Entre em contato com seu fisioterapeuta.');
      this.loaded = { code, ownerId: data['ownerId'], patientId: data['patientId'], revision: data['revision'] };
      return therapyPlan(data['patientId'], data['revision'], data['therapy']);
    } catch (error) {
      if ((error as { code?: string }).code === 'permission-denied') return null;
      throw Error('Não foi possível consultar a terapia. Verifique a conexão e tente novamente.');
    }
  }
  async validateAccess(plan: SessionPlan): Promise<boolean> {
    if (plan.gameId === 'goalkeeper' && plan.id === 'goleiro-demo' && plan.patientId === 'jogador-demo')
      return true;
    const loaded = this.loaded;
    if (!loaded || loaded.patientId !== plan.patientId || loaded.revision !== plan.version) return false;
    const snapshot = await getDocFromServer(doc(this.db, 'patientAccess', loaded.code));
    return snapshot.exists() && snapshot.data()['revision'] === loaded.revision;
  }
  listResults(patientId: string): Promise<SessionResult[]> { return this.local.listResults(patientId); }

  publishesResults(plan: SessionPlan): boolean {
    return plan.patientId !== 'jogador-demo' && (plan.gameId === 'shoulder' || plan.gameId === 'goalkeeper');
  }

  async saveResult(result: SessionResult): Promise<void> {
    const { gameId, version, title } = result.plan;
    const { movement } = result;
    if (!movement || !this.publishesResults(result.plan) || gameId === 'surfing') {
      await this.local.saveResult(result);
      return;
    }
    const access = this.loaded;
    try {
      await this.local.saveResult(result);
    } catch (error) {
      console.warn('Histórico local indisponível:', error);
    }
    if (!access || access.patientId !== result.patientId || access.revision !== version)
      throw Error('A terapia deste resultado não está mais ativa.');
    if (navigator.onLine === false) throw Error('Sem conexão para enviar o resultado.');

    const report: SessionReport = {
      schemaVersion: 1, gameId, title, revision: version,
      completedAtMs: Date.parse(result.completedAt),
      activeMs: Math.round(result.activeMs), pausedMs: Math.round(result.pausedMs),
      endReason: result.endReason, hits: result.hits, misses: result.misses, points: result.points,
      movement,
    };
    const ref = doc(this.db, 'professionals', access.ownerId, 'patients', access.patientId, 'results', result.id);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        setDoc(ref, { ...report, accessCode: access.code }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(Error('Envio ainda não confirmado.')), 10000);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }
}
