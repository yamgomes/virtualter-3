import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import simdLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import simdBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import fallbackLoader from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url';
import fallbackBinary from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url';
import { LANDMARK_NAMES } from './types';
import type { Landmarks, PoseFrame, PoseSource } from './types';

/** Adaptador: nenhum índice ou tipo do MediaPipe passa desta fronteira. */
export class MediaPipePoseSource implements PoseSource {
  private detector: PoseLandmarker | null = null;
  private video: HTMLVideoElement;
  private videoTime = -1;
  private lastFrame: PoseFrame | null = null;
  private initialization: Promise<void> | null = null;
  private generation = 0;
  constructor(video: HTMLVideoElement) {
    this.video = video;
  }
  async initialize(): Promise<void> {
    if (this.detector) return;
    if (this.initialization) return this.initialization;
    const generation = this.generation;
    this.initialization = this.createDetector(generation);
    try {
      await this.initialization;
    } finally {
      this.initialization = null;
    }
  }
  private async createDetector(generation: number): Promise<void> {
    const simd = await FilesetResolver.isSimdSupported();
    const vision = {
      wasmLoaderPath: simd ? simdLoader : fallbackLoader,
      wasmBinaryPath: simd ? simdBinary : fallbackBinary,
    };
    const detector = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
      },
      runningMode: 'VIDEO',
    });
    if (this.generation !== generation) detector.close();
    else this.detector = detector;
  }
  async detect(): Promise<PoseFrame | null> {
    if (
      !this.detector ||
      this.video.readyState < 2 ||
      !this.video.srcObject ||
      !this.video.videoHeight
    )
      return null;
    if (this.video.currentTime === this.videoTime) return this.lastFrame;
    this.videoTime = this.video.currentTime;
    const timestamp = performance.now();
    const result = this.detector.detectForVideo(this.video, timestamp);
    const source = result.landmarks[0];
    if (!source) {
      this.lastFrame = null;
      return null;
    }
    const points: Landmarks = {};
    LANDMARK_NAMES.forEach((name, index) => {
      const point = source[index];
      if (point)
        points[name] = {
          x: point.x,
          y: point.y,
          visibility: point.visibility ?? 1,
        };
    });
    this.lastFrame = {
      points,
      timestamp,
      aspectRatio: this.video.videoWidth / this.video.videoHeight,
    };
    return this.lastFrame;
  }
  dispose(): void {
    this.generation++;
    this.detector?.close();
    this.detector = null;
    this.videoTime = -1;
    this.lastFrame = null;
  }
}
