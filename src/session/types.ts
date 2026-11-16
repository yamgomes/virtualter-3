import type { ShoulderValues } from '../exercise/automaticCalibration';
/** Dados de demonstração; códigos locais não representam autenticação. */
export interface SessionPlan {
  id: string; patientId: string; displayName: string; title: string;
  targets: ShoulderValues[]; repetitions: number; holdMs: number; beatMs: number;
}
export interface SessionResult {
  id: string; patientId: string; planId: string; planTitle: string; completedAt: string;
  durationSeconds: number; completedTargets: number; plannedTargets: number;
}
export interface SessionRepository {
  getPlanByCode(code: string): Promise<SessionPlan | null>;
  listResults(patientId: string): Promise<SessionResult[]>;
  saveResult(result: SessionResult): Promise<void>;
}
