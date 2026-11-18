import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { GAME_CONFIG } from './constants';

export class PoseDetector {
  private poseLandmarker!: PoseLandmarker;
  private video: HTMLVideoElement;
  private isInitialized = false;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
      },
      runningMode: 'VIDEO',
    });

    this.isInitialized = true;
  }

  async detectPose(): Promise<PoseLandmarkerResult | null> {
    if (!this.isInitialized || this.video.readyState < 2) {
      return null;
    }

    // Check if video has a stream (camera is enabled)
    if (!this.video.srcObject) {
      return null;
    }

    return this.poseLandmarker.detectForVideo(this.video, performance.now());
  }

  static detectTPose(landmarks: any[]): boolean {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    return (
      Math.abs(leftWrist.y - leftShoulder.y) <
        GAME_CONFIG.TPOSE_DETECTION_THRESHOLDS.Y_TOLERANCE &&
      Math.abs(rightWrist.y - rightShoulder.y) <
        GAME_CONFIG.TPOSE_DETECTION_THRESHOLDS.Y_TOLERANCE &&
      Math.abs(leftWrist.x - leftShoulder.x) >
        GAME_CONFIG.TPOSE_DETECTION_THRESHOLDS.X_MIN_DISTANCE &&
      Math.abs(rightWrist.x - rightShoulder.x) >
        GAME_CONFIG.TPOSE_DETECTION_THRESHOLDS.X_MIN_DISTANCE
    );
  }

  static getHandPosition(landmarks: any[]): { x: number; y: number } {
    const rightWrist = landmarks[16];
    return {
      x:
        (rightWrist.x - GAME_CONFIG.HAND_POSITION_SCALE.X_OFFSET) *
        GAME_CONFIG.HAND_POSITION_SCALE.X,
      y:
        -(rightWrist.y - GAME_CONFIG.HAND_POSITION_SCALE.Y_OFFSET) *
        GAME_CONFIG.HAND_POSITION_SCALE.Y,
    };
  }
}
