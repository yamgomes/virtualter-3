import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { LANDMARK_NAMES } from './types';
import type { Landmarks, PoseFrame, PoseSource } from './types';

/** Adaptador: nenhum índice ou tipo do MediaPipe passa desta fronteira. */
export class MediaPipePoseSource implements PoseSource {
  private detector: PoseLandmarker | null = null;
  private video: HTMLVideoElement;
  constructor(video: HTMLVideoElement) { this.video = video; }
  async initialize(): Promise<void> {
    if (this.detector) return;
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
    this.detector = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task' },
      runningMode: 'VIDEO',
    });
  }
  async detect(): Promise<PoseFrame | null> {
    if (!this.detector || this.video.readyState < 2 || !this.video.srcObject || !this.video.videoHeight) return null;
    const timestamp = performance.now();
    const result = this.detector.detectForVideo(this.video, timestamp);
    const source = result.landmarks[0];
    if (!source) return null;
    const points: Landmarks = {};
    LANDMARK_NAMES.forEach((name, index) => {
      const point = source[index];
      if (point) points[name] = { x: point.x, y: point.y, visibility: point.visibility ?? 1 };
    });
    return { points, timestamp, aspectRatio: this.video.videoWidth / this.video.videoHeight };
  }
  dispose(): void { this.detector?.close(); this.detector = null; }
}
