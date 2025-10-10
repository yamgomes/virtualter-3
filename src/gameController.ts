import { GameStateManager, GameplayState } from "./gameState";
import { UIManager } from "./uiManager";
import { SceneManager } from "./sceneManager";
import { PoseDetector } from "./poseDetector";
import { VideoManager } from "./videoManager";
import { GAME_CONFIG } from "./constants";

export class GameController {
  private gameState: GameStateManager;
  private ui: UIManager;
  private scene: SceneManager;
  private poseDetector: PoseDetector;
  private video: VideoManager;

  private tPoseStartTime: number | null = null;

  constructor() {
    this.gameState = new GameStateManager();
    this.ui = new UIManager();
    this.video = new VideoManager();
    this.scene = new SceneManager();
    this.poseDetector = new PoseDetector(this.video.video);

    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.poseDetector.initialize();
    this.scene.setupVideoBackground(this.video.video);
    this.startGameLoop();
    this.startRenderLoop();
  }

  private startGameLoop(): void {
    const gameLoop = async () => {
      const result = await this.poseDetector.detectPose();

      if (result && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];
        this.handlePoseDetection(landmarks);
      }

      requestAnimationFrame(gameLoop);
    };

    gameLoop();
  }

  private handlePoseDetection(landmarks: any[]): void {
    const tPose = PoseDetector.detectTPose(landmarks);

    if (this.gameState.isWaitingToStart()) {
      this.handleWaitingState(tPose);
    } else if (this.gameState.isPlaying()) {
      this.handlePlayingState(landmarks);
    }
  }

  private handleWaitingState(tPose: boolean): void {
    if (tPose) {
      if (!this.tPoseStartTime) {
        this.tPoseStartTime = performance.now();
      }

      const elapsed = performance.now() - this.tPoseStartTime;
      const percent = Math.min(100, (elapsed / GAME_CONFIG.TPOSE_REQUIRED_TIME) * 100);

      this.ui.updateTPoseProgress(percent);

      if (elapsed >= GAME_CONFIG.TPOSE_REQUIRED_TIME) {
        this.startGame();
      }
    } else {
      this.resetTPoseProgress();
    }
  }

  private handlePlayingState(landmarks: any[]): void {
    const handPosition = PoseDetector.getHandPosition(landmarks);
    this.scene.updateCubePosition(handPosition.x, handPosition.y);
  }

  private startGame(): void {
    this.gameState.setState(GameplayState.Playing);
    this.ui.hideStartMessage();
    this.ui.hideTPoseBar();
    this.scene.showCube();
    this.resetTPoseProgress();
  }

  private resetTPoseProgress(): void {
    this.ui.resetTPoseProgress();
    this.tPoseStartTime = null;
  }

  private startRenderLoop(): void {
    const render = () => {
      this.scene.render();
      requestAnimationFrame(render);
    };
    render();
  }
}