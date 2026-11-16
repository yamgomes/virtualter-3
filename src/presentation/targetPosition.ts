import type { PoseFrame } from '../tracking/types';
import type { BilateralCalibration } from '../exercise/automaticCalibration';
import type { ShoulderLevels } from '../exercise/shoulderInput';
import type { Side } from '../exercise/shoulderMotion';

/** Posição na cena espelhada do cotovelo para o ângulo-alvo projetado. */
export function targetPosition(frame: PoseFrame, calibration: BilateralCalibration, targets: ShoulderLevels, side: Side): { x: number; y: number } | null {
  const p = frame.points, aspect = frame.aspectRatio;
  const shoulder = p[side === 'left' ? 'leftShoulder' : 'rightShoulder'];
  const other = p[side === 'left' ? 'rightShoulder' : 'leftShoulder'];
  const elbow = p[side === 'left' ? 'leftElbow' : 'rightElbow'];
  const hip = p[side === 'left' ? 'leftHip' : 'rightHip'];
  if (!shoulder || !other || !elbow || !hip || !Number.isFinite(aspect) || aspect <= 0) return null;
  const tx = (hip.x - shoulder.x) * aspect, ty = hip.y - shoulder.y;
  const trunkLength = Math.hypot(tx, ty);
  const armLength = Math.hypot((elbow.x - shoulder.x) * aspect, elbow.y - shoulder.y);
  if (trunkLength < 0.0001 || armLength < 0.0001) return null;
  const theta = (calibration[side].rest + (calibration[side].maximum - calibration[side].rest) * targets[side]) * Math.PI / 180;
  const outward = shoulder.x >= other.x ? 1 : -1;
  const dx = (tx * Math.cos(theta) + outward * ty * Math.sin(theta)) / trunkLength * armLength;
  const dy = (ty * Math.cos(theta) - outward * tx * Math.sin(theta)) / trunkLength * armLength;
  return { x: (0.5 - shoulder.x) * aspect - dx, y: 0.5 - shoulder.y - dy };
}
