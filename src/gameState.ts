// Gerenciamento de estados do jogo
export const GameplayState = {
  WaitingToStart: 0,
  Playing: 1,
} as const;

export type GameplayStateType = typeof GameplayState[keyof typeof GameplayState];

export class GameStateManager {
  private _currentState: GameplayStateType = GameplayState.WaitingToStart;
  private gameHeader: HTMLElement | null;

  constructor() {
    this.gameHeader = document.getElementById("game-header");
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
        this.gameHeader.innerText = "Virtualter 3 - Estado: Esperando iniciar";
        break;
      case GameplayState.Playing:
        this.gameHeader.innerText = "Virtualter 3 - Estado: Jogando";
        break;
      default:
        this.gameHeader.innerText = "Virtualter 3";
        break;
    }
  }

  isWaitingToStart(): boolean {
    return this._currentState === GameplayState.WaitingToStart;
  }

  isPlaying(): boolean {
    return this._currentState === GameplayState.Playing;
  }
}