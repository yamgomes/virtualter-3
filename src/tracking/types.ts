/** Coordenadas normalizadas da imagem, com origem no canto superior esquerdo. */
export const LANDMARK_NAMES = [
  'nose',
  'leftEyeInner',
  'leftEye',
  'leftEyeOuter',
  'rightEyeInner',
  'rightEye',
  'rightEyeOuter',
  'leftEar',
  'rightEar',
  'mouthLeft',
  'mouthRight',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftPinky',
  'rightPinky',
  'leftIndex',
  'rightIndex',
  'leftThumb',
  'rightThumb',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
  'leftHeel',
  'rightHeel',
  'leftFoot',
  'rightFoot',
] as const;
export type LandmarkName = (typeof LANDMARK_NAMES)[number];
export interface Landmark {
  x: number;
  y: number;
  visibility: number;
}
export type Landmarks = Partial<Record<LandmarkName, Landmark>>;
export interface PoseFrame {
  points: Landmarks;
  timestamp: number;
  aspectRatio: number;
}
export interface PoseSource {
  initialize(): Promise<void>;
  detect(): Promise<PoseFrame | null>;
  dispose(): void;
}
