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
  private goalStartTime: number | null = null;
  private goalCompletedTime: number | null = null;

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

    // Setup goal callbacks
    this.scene.setGoalCallbacks(
      (goal) => this.onGoalReached(goal),
      () => this.onGoalCompleted()
    );

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
    } else if (this.gameState.isGoalActive()) {
      this.handleGoalState(landmarks);
    } else if (this.gameState.isGoalCompleted()) {
      // Don't update pose during completed state to avoid lag
      this.handleGoalCompletedState();
      return; // Skip pose update
    }

    // Update the character pose only if not in completed state
    this.scene.updatePose(landmarks);
  }

  private handleWaitingState(tPose: boolean): void {
    if (tPose) {
      if (!this.tPoseStartTime) {
        this.tPoseStartTime = performance.now();
        this.ui.showTPoseBar(); // Show progress bar when T-pose starts
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
    this.scene.updatePose(landmarks);

    // Start a new goal after a short delay
    if (!this.goalStartTime) {
      this.goalStartTime = performance.now();
    }

    if (performance.now() - this.goalStartTime > 1000) { // Reduced from 2000 to 1000ms
      this.startGoal();
    }
  }

  private handleGoalState(landmarks: any[]): void {
    this.scene.updatePose(landmarks);

    // Check if player matches the goal
    if (this.scene.checkPlayerGoal(landmarks)) {
      this.completeGoal();
    }
  }

  private handleGoalCompletedState(): void {
    // Update pose even in completed state to keep character moving
    this.scene.updatePose([]);

    // Wait a moment then start a new goal using time-based approach
    if (!this.goalCompletedTime) {
      this.goalCompletedTime = performance.now();
    }

    if (performance.now() - this.goalCompletedTime > 800) { // Reduced to 800ms for faster cycling
      this.startGoal();
      this.goalCompletedTime = null;
    }
  }

  private startGoal(): void {
    this.gameState.setState(GameplayState.GoalActive);
    this.scene.startNewGoal();
    this.goalStartTime = null;
  }

  private completeGoal(): void {
    this.gameState.setState(GameplayState.GoalCompleted);
    this.scene.completeGoal();
  }

  private onGoalReached(goal: any): void {
    console.log('Goal reached! Target angles:', goal);
    // Balls have reached center, player should position arms now
  }

  private onGoalCompleted(): void {
    console.log('Goal completed successfully!');
    // Goal was completed, ready for next one
  }

  private startGame(): void {
    this.gameState.setState(GameplayState.Playing);
    this.ui.hideStartMessage();
    this.ui.hideTPoseBar();
    this.scene.showCharacter();
    this.scene.hideVideoBackground(); // Hide webcam feed when playing
    this.resetTPoseProgress();
  }

  private resetTPoseProgress(): void {
    this.ui.resetTPoseProgress();
    this.ui.hideTPoseBar(); // Hide progress bar when resetting
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