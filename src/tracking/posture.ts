import type { PoseFrame } from './types';

/** Tolerância adimensional para a razão entre largura dos ombros e comprimento do tronco. */
export type PostureMode = 'front' | 'front-palms-up' | 'side';
export interface PostureRequirement {
  mode: PostureMode;
  tolerance: number;
}
export interface PostureObservation {
  state: 'valid' | 'invalid' | 'unknown';
  message: string;
  ratio?: number;
  /** O tronco está alinhado, embora outros requisitos possam ser desconhecidos. */
  bodyAligned?: boolean;
}

/** Heurística 2D exploratória, não é uma medida de orientação em graus. */
export function observePosture(
  frame: PoseFrame | null,
  requirement: PostureRequirement
): PostureObservation {
  if (!frame || !Number.isFinite(frame.aspectRatio) || frame.aspectRatio <= 0)
    return {
      state: 'unknown',
      message:
        'Não foi possível verificar a posição. Enquadre ombros e quadris.',
    };
  const {
    leftShoulder: ls,
    rightShoulder: rs,
    leftHip: lh,
    rightHip: rh,
  } = frame.points;
  if (
    !ls ||
    !rs ||
    !lh ||
    !rh ||
    [ls, rs, lh, rh].some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        !Number.isFinite(p.visibility) ||
        p.visibility < 0.5
    )
  )
    return {
      state: 'unknown',
      message: 'Posição não verificável: enquadre os dois ombros e quadris.',
    };
  const aspect = frame.aspectRatio;
  const width = Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y);
  const torso =
    (Math.hypot((ls.x - lh.x) * aspect, ls.y - lh.y) +
      Math.hypot((rs.x - rh.x) * aspect, rs.y - rh.y)) /
    2;
  if (torso < 0.04)
    return {
      state: 'unknown',
      message: 'Posição não verificável: aproxime-se da câmera.',
    };
  const ratio = width / torso;
  const tolerance = Math.max(0, Math.min(1, requirement.tolerance));
  if (requirement.mode === 'side') {
    return ratio > 0.45 + tolerance * 0.5
      ? {
          state: 'invalid',
          message: 'Ajuste a posição: fique de lado para a câmera.',
          ratio,
        }
      : { state: 'valid', message: 'Posição lateral detectada.', ratio };
  }
  if (ratio < 0.6 * (1 - tolerance))
    return {
      state: 'invalid',
      message: 'Ajuste a posição: fique de frente para a câmera.',
      ratio,
    };
  if (requirement.mode === 'front-palms-up')
    return {
      state: 'unknown',
      message:
        'Frente detectada; orientação das palmas não verificável com o rastreamento atual.',
      ratio,
      bodyAligned: true,
    };
  return { state: 'valid', message: 'Posição frontal detectada.', ratio };
}

/** Evita alertas por uma única amostra; estados desconhecidos nunca viram violação. */
export class PostureMonitor {
  private invalidSince: number | null = null;
  private requirement: PostureRequirement;
  private delayMs: number;
  constructor(
    requirement: PostureRequirement,
    delayMs = 500
  ) { this.requirement = requirement; this.delayMs = delayMs; }
  update(frame: PoseFrame | null, now: number): PostureObservation {
    const observation = observePosture(frame, this.requirement);
    if (observation.state !== 'invalid' || !Number.isFinite(now)) {
      this.invalidSince = null;
      return observation;
    }
    if (this.invalidSince === null || now < this.invalidSince)
      this.invalidSince = now;
    return now - this.invalidSince >= this.delayMs
      ? observation
      : { ...observation, state: 'unknown', message: 'Verificando a posição…' };
  }
  reset(): void {
    this.invalidSince = null;
  }
}
