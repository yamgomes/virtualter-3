import type { PoseFrame } from '../tracking/types';
export type Side = 'left' | 'right';
export interface Calibration { rest: number; maximum: number }

/** Ângulo projetado na imagem entre o tronco e o braço, não uma medida clínica 3D. */
export function shoulderAngle(frame: PoseFrame, side: Side): number | null {
  const { points, aspectRatio } = frame;
  const shoulder = points[side === 'left' ? 'leftShoulder' : 'rightShoulder'];
  const elbow = points[side === 'left' ? 'leftElbow' : 'rightElbow'];
  const hip = points[side === 'left' ? 'leftHip' : 'rightHip'];
  if (!shoulder || !elbow || !hip || [shoulder, elbow, hip].some(p => p.visibility < 0.5 || !Number.isFinite(p.x) || !Number.isFinite(p.y)) || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
  const ax = (elbow.x - shoulder.x) * aspectRatio, ay = elbow.y - shoulder.y;
  const bx = (hip.x - shoulder.x) * aspectRatio, by = hip.y - shoulder.y;
  const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (length < 0.0001) return null;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / length))) * 180 / Math.PI;
}
export function createCalibration(rest: number, maximum: number): Calibration | null {
  return Number.isFinite(rest) && Number.isFinite(maximum) && maximum - rest >= 15 ? { rest, maximum } : null;
}
export function normalizeShoulder(angle: number, calibration: Calibration): number {
  return Math.max(0, Math.min(1, (angle - calibration.rest) / (calibration.maximum - calibration.rest)));
}
