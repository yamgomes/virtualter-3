import type { Therapy } from '@homephysio/contracts';
import { gamePlans } from '../games/planRegistry';
import type { SessionPlan } from './types';

export function therapyPlan(
  patientId: string,
  revision: number,
  therapy: Therapy
): SessionPlan {
  return {
    id: patientId,
    patientId,
    version: revision,
    displayName: 'Paciente',
    title: therapy.title,
    metrics: therapy.metrics,
    intensity: therapy.intensity,
    ...gamePlans[therapy.gameId].fromTherapy(therapy),
  };
}
