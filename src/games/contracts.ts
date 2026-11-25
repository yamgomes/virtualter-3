import type { GameId } from '@homephysio/contracts';
import type { PoseFrame } from '../tracking/types';
import type { GameResult, SessionPlan } from '../session/types';
import type { PostureRequirement } from '../tracking/posture';
export interface PreparationProgress {
  title: string;
  message: string;
  progress: number;
  complete: boolean;
}
/** Coordenador privado do jogo: compõe sensores, regras e uma apresentação própria. */
export interface GameActivity {
  readonly version: string;
  readonly instructions: string;
  readonly planDescription: string;
  /** Declarada pelo jogo; omitir quando não houver orientação obrigatória. */
  readonly posture?: PostureRequirement;
  calibrate(frame: PoseFrame | null, now: number): PreparationProgress;
  resetCalibration(): void;
  start(stage: HTMLElement, panel: HTMLElement): void;
  update(
    frame: PoseFrame | null,
    now: number
  ): { tracking: boolean; completed: boolean; hits?: number };
  render(now: number): void;
  result(): GameResult;
  dispose(): void;
}
export type ActivityFactory<Id extends GameId = GameId> = (
  plan: SessionPlan<Id>
) => GameActivity;
