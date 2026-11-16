import type { PoseFrame } from '../tracking/types';
import type { Side } from './shoulderMotion';

/** Inclinação 2D do tronco em vista lateral. O lado visível é fixado pelo plano. */
export function trunkLean(frame: PoseFrame, side: Side): number | null {
  const shoulder =
    frame.points[side === 'left' ? 'leftShoulder' : 'rightShoulder'];
  const hip = frame.points[side === 'left' ? 'leftHip' : 'rightHip'];
  if (
    !shoulder ||
    !hip ||
    [shoulder, hip].some(
      (p) =>
        p.visibility < 0.5 || !Number.isFinite(p.x) || !Number.isFinite(p.y)
    ) ||
    !Number.isFinite(frame.aspectRatio) ||
    frame.aspectRatio <= 0
  )
    return null;
  const dx = (shoulder.x - hip.x) * frame.aspectRatio,
    dy = hip.y - shoulder.y;
  if (dy <= 0 || Math.hypot(dx, dy) < 0.02) return null;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}
export interface LeanRange {
  rest: number;
  maximum: number;
}
/** O sinal é aprendido na calibração: virar para o outro lado não inverte o controle. */
export function normalizeLean(angle: number, range: LeanRange): number {
  return Math.max(
    0,
    Math.min(1, (angle - range.rest) / (range.maximum - range.rest))
  );
}
export class LeanCalibration {
  private stage: 'rest' | 'maximum' | 'complete' = 'rest';
  private anchor: number | null = null;
  private since = 0;
  private lastTime: number | null = null;
  private rest = 0;
  private result: LeanRange | null = null;
  update(angle: number | null, now: number) {
    if (this.result)
      return {
        stage: this.stage,
        progress: 1,
        result: this.result,
        message: 'Calibração concluída.',
      };
    const reset = () => {
      this.anchor = null;
      this.lastTime = null;
    };
    if (angle === null || !Number.isFinite(angle) || !Number.isFinite(now)) {
      reset();
      return {
        stage: this.stage,
        progress: 0,
        result: null,
        message: 'Enquadre o ombro e o quadril do lado indicado.',
      };
    }
    if (
      this.lastTime !== null &&
      (now <= this.lastTime || now - this.lastTime > 500)
    )
      reset();
    this.lastTime = now;
    if (this.stage === 'maximum' && Math.abs(angle - this.rest) < 10) {
      reset();
      return {
        stage: this.stage,
        progress: 0,
        result: null,
        message:
          'Incline o tronco para a frente, dentro do seu alcance confortável.',
      };
    }
    if (this.anchor === null || Math.abs(angle - this.anchor) > 4) {
      this.anchor = angle;
      this.since = now;
    }
    const progress = Math.min(1, (now - this.since) / 1800);
    if (progress < 1)
      return {
        stage: this.stage,
        progress,
        result: null,
        message: 'Mantenha a posição por um instante.',
      };
    if (this.stage === 'rest') {
      this.rest = angle;
      this.stage = 'maximum';
      reset();
      return {
        stage: this.stage,
        progress: 0,
        result: null,
        message: 'Agora incline o tronco para a frente e mantenha.',
      };
    }
    this.result = { rest: this.rest, maximum: angle };
    this.stage = 'complete';
    return {
      stage: this.stage,
      progress: 1,
      result: this.result,
      message: 'Calibração concluída.',
    };
  }
}
