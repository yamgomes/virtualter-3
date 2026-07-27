// Gerenciamento de estados do jogo
export const GameplayState = {
  WaitingToStart: 0,
  Playing: 1,
  GoalActive: 2,
  GoalCompleted: 3,
} as const;

export type GameplayStateType =
  (typeof GameplayState)[keyof typeof GameplayState];

export class GameStateManager {
  private _currentState: GameplayStateType = GameplayState.WaitingToStart;
  private gameHeader: HTMLElement | null;

  constructor() {
    this.gameHeader = document.getElementById('game-header');
    this.updateHeader();
  }

  get currentState(): GameplayStateType {
    return this._currentState;
  }

  setState(newState: GameplayStateType): void {
    this._currentState = newState;
    this.updateHeader();
  }

  private updateHeader(): void {
    if (!this.gameHeader) return;

    switch (this._currentState) {
      case GameplayState.WaitingToStart:
        this.gameHeader.innerText = 'Nome Temporário - Esperando iniciar';
        break;
      case GameplayState.Playing:
        this.gameHeader.innerText = 'Nome Temporário - Jogando';
        break;
      case GameplayState.GoalActive:
        this.gameHeader.innerText = 'Nome Temporário - Posicione seus braços!';
        break;
      case GameplayState.GoalCompleted:
        this.gameHeader.innerText = 'Nome Temporário - Meta concluída!';
        break;
      default:
        this.gameHeader.innerText = 'Nome Temporário';
        break;
    }
  }

  isWaitingToStart(): boolean {
    return this._currentState === GameplayState.WaitingToStart;
  }

  isPlaying(): boolean {
    return this._currentState === GameplayState.Playing;
  }

  isGoalActive(): boolean {
    return this._currentState === GameplayState.GoalActive;
  }

  isGoalCompleted(): boolean {
    return this._currentState === GameplayState.GoalCompleted;
  }
}
