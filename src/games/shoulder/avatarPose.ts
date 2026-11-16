import type { Side } from '../../exercise/shoulderMotion';

/** Posição do braço do personagem a partir do ângulo em graus. */
export function avatarArm(side: Side, degrees: number): { shoulder: [number, number]; elbow: [number, number]; hand: [number, number] } {
  const sign = side === 'left' ? -1 : 1;
  const angle = degrees * Math.PI / 180;
  const shoulder: [number, number] = [sign * 0.13, 0.14];
  const dx = sign * Math.sin(angle), dy = -Math.cos(angle);
  return { shoulder, elbow: [shoulder[0] + dx * 0.18, shoulder[1] + dy * 0.18], hand: [shoulder[0] + dx * 0.36, shoulder[1] + dy * 0.36] };
}
