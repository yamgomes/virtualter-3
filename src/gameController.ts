import { GameStateManager, GameplayState } from "./gameState";
import { UIManager } from "./uiManager";
import { SceneManager } from "./sceneManager";
import { PoseDetector } from "./poseDetector";
import { VideoManager } from "./videoManager";
import { GameModeManager } from "./gameModeManager";
import { GameSelectionUI } from "./gameSelectionUI";
import type { GameMode } from "./gameMode";
import { GAME_CONFIG } from "./constants";

export class GameController {
  private gameState: GameStateManager;
  private ui: UIManager;
  private scene: SceneManager;
  private poseDetector: PoseDetector;
  private video: VideoManager;
  private gameModeManager: GameModeManager;
  private gameSelectionUI!: GameSelectionUI;
  private currentGameMode: GameMode | null = null;

  private tPoseStartTime: number | null = null;
  private goalStartTime: number | null = null;
  private goalCompletedTime: number | null = null;
  private currentGoal: any = null;

  constructor() {
    this.gameState = new GameStateManager();
    this.ui = new UIManager();
    this.video = new VideoManager();
    this.scene = new SceneManager();
    this.poseDetector = new PoseDetector(this.video.video);
    this.gameModeManager = GameModeManager.getInstance();

    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.poseDetector.initialize();
    this.scene.setupVideoBackground(this.video.video);

    // Cria a UI de seleção após os elementos estarem prontos
    this.gameSelectionUI = new GameSelectionUI();

    // Setup UI callbacks
    this.gameSelectionUI.setOnGameSelected((gameMode) => this.onGameModeSelected(gameMode));

    // Show game selection screen
    this.gameSelectionUI.show();

    this.startGameLoop();
    this.startRenderLoop();
  }

  private onGameModeSelected(gameModeName: string): void {
    console.log(`Modo de jogo selecionado: ${gameModeName}`);

    // Cria instância do modo de jogo
    this.currentGameMode = this.gameModeManager.createGameMode(gameModeName);

    if (!this.currentGameMode) {
      console.error(`Falha ao criar modo de jogo: ${gameModeName}`);
      return;
    }

    // Inicializa o modo de jogo com a cena
    this.currentGameMode.initialize(this.scene.scene);

    // Esconde a UI de seleção e mostra o jogo
    this.gameSelectionUI.hide();

    console.log(`Modo de jogo ${gameModeName} inicializado com sucesso`);
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
    // Se não há modo de jogo selecionado, não faz nada
    if (!this.currentGameMode) {
      return;
    }

    const tPose = PoseDetector.detectTPose(landmarks);

    if (this.gameState.isWaitingToStart()) {
      this.handleWaitingState(tPose);
    } else if (this.gameState.isPlaying()) {
      this.handlePlayingState(landmarks);
    } else if (this.gameState.isGoalActive()) {
      this.handleGoalState(landmarks);
    } else if (this.gameState.isGoalCompleted()) {
      this.handleGoalCompletedState();
      return;
    }

    // Update the character pose
    this.scene.updatePose(landmarks);
  }

  private handleWaitingState(tPose: boolean): void {
    if (tPose) {
      if (!this.tPoseStartTime) {
        this.tPoseStartTime = performance.now();
        this.ui.showTPoseBar();
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
    if (!this.currentGameMode) return;

    this.scene.updatePose(landmarks);

    // Start a new goal after a short delay
    if (!this.goalStartTime) {
      this.goalStartTime = performance.now();
    }

    const config = this.currentGameMode.getGameConfig();
    if (performance.now() - this.goalStartTime > config.goalDelayTime) {
      this.startGoal();
    }
  }

  private handleGoalState(landmarks: any[]): void {
    if (!this.currentGameMode || !this.currentGoal) return;

    this.scene.updatePose(landmarks);

    // Check if player achieved the goal using the current game mode
    if (this.currentGameMode.checkGoalAchieved(landmarks, this.currentGoal)) {
      this.completeGoal();
    }
  }

  private handleGoalCompletedState(): void {
    if (!this.currentGameMode) return;

    // Wait a moment then start a new goal
    if (!this.goalCompletedTime) {
      this.goalCompletedTime = performance.now();
    }

    const config = this.currentGameMode.getGameConfig();
    if (performance.now() - this.goalCompletedTime > config.goalCompletedDelay) {
      this.startGoal();
      this.goalCompletedTime = null;
    }
  }

  private startGoal(): void {
    if (!this.currentGameMode) return;

    // Create new goal using current game mode
    this.currentGoal = this.currentGameMode.createGoal();

    // Update goal visualization
    this.currentGameMode.updateGoalVisualization(this.currentGoal);

    this.gameState.setState(GameplayState.GoalActive);
    this.goalStartTime = null;

    console.log('New goal started:', this.currentGoal);
  }

  private completeGoal(): void {
    console.log('Goal completed successfully!');
    this.gameState.setState(GameplayState.GoalCompleted);
    this.currentGoal = null;
  }

  private startGame(): void {
    this.gameState.setState(GameplayState.Playing);
    this.ui.hideStartMessage();
    this.ui.hideTPoseBar();
    this.scene.showCharacter();
    this.scene.hideVideoBackground();
    this.resetTPoseProgress();
  }

  private resetTPoseProgress(): void {
    this.ui.resetTPoseProgress();
    this.ui.hideTPoseBar();
    this.tPoseStartTime = null;
  }

  private startRenderLoop(): void {
    const render = () => {
      // Update game mode animations if available
      if (this.currentGameMode && typeof (this.currentGameMode as any).updateGoalAnimation === 'function') {
        (this.currentGameMode as any).updateGoalAnimation();
      }

      this.scene.render();
      requestAnimationFrame(render);
    };
    render();
  }
}