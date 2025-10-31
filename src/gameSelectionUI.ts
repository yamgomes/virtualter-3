import { GameModeManager } from "./gameModeManager";

/**
 * Gerencia a interface de seleção de jogos
 */
export class GameSelectionUI {
  private gameModeManager: GameModeManager;
  private selectedGameMode: string | null = null;
  private onGameSelected?: (gameMode: string) => void;

  private selectionScreen!: HTMLElement;
  private gamesContainer!: HTMLElement;
  private startButton!: HTMLButtonElement;
  private gameHeader?: HTMLElement;
  private gameTitle?: HTMLElement;

  constructor() {
    this.gameModeManager = GameModeManager.getInstance();
    this.initializeElements();
    this.setupEventListeners();
    this.loadAvailableGames();
  }

  /**
   * Define callback para quando um jogo for selecionado
   */
  public setOnGameSelected(callback: (gameMode: string) => void): void {
    this.onGameSelected = callback;
  }

  /**
   * Mostra a tela de seleção de jogos
   */
  public show(): void {
    this.selectionScreen.classList.remove('hidden');

    // Esconde o header do jogo se existir
    if (this.gameHeader) {
      this.gameHeader.classList.add('hidden');
    }
  }

  /**
   * Esconde a tela de seleção e mostra o header do jogo
   */
  public hide(): void {
    this.selectionScreen.classList.add('hidden');

    // Verifica se os elementos do header existem antes de usá-los
    if (this.gameHeader) {
      this.gameHeader.classList.remove('hidden');
    }

    // Atualiza o título do header com o jogo selecionado
    if (this.selectedGameMode && this.gameTitle) {
      const metadata = this.gameModeManager.getModeMetadata(this.selectedGameMode);
      if (metadata) {
        this.gameTitle.textContent = metadata.displayName;
      }
    }
  }

  /**
   * Retorna o jogo atualmente selecionado
   */
  public getSelectedGame(): string | null {
    return this.selectedGameMode;
  }

  private initializeElements(): void {
    // Elementos que devem estar sempre visíveis
    const requiredElements = [
      { id: 'game-selection', name: 'selectionScreen' },
      { id: 'games-container', name: 'gamesContainer' },
      { id: 'start-game-btn', name: 'startButton' }
    ];

    // Elementos que podem estar ocultos inicialmente
    const optionalElements = [
      { id: 'game-header', name: 'gameHeader' },
      { id: 'game-title', name: 'gameTitle' }
    ];

    const missingElements: string[] = [];

    // Verifica elementos obrigatórios
    requiredElements.forEach(({ id, name }) => {
      const element = document.getElementById(id);
      if (!element) {
        missingElements.push(`#${id} (${name})`);
      } else {
        this.assignElement(name, element);
      }
    });

    // Verifica elementos opcionais (não falha se não encontrar)
    optionalElements.forEach(({ id, name }) => {
      const element = document.getElementById(id);
      if (element) {
        this.assignElement(name, element);
      } else {
        console.warn(`Elemento opcional não encontrado: #${id} (${name})`);
      }
    });

    if (missingElements.length > 0) {
      console.error('Elementos HTML obrigatórios não encontrados:', missingElements);
      console.error('DOM atual:', document.documentElement.outerHTML);
      throw new Error(`Elementos HTML necessários não encontrados: ${missingElements.join(', ')}`);
    }

    console.log('Elementos HTML principais foram encontrados com sucesso');
  }

  private assignElement(name: string, element: HTMLElement): void {
    switch (name) {
      case 'selectionScreen':
        this.selectionScreen = element;
        break;
      case 'gamesContainer':
        this.gamesContainer = element;
        break;
      case 'startButton':
        this.startButton = element as HTMLButtonElement;
        break;
      case 'gameHeader':
        this.gameHeader = element;
        break;
      case 'gameTitle':
        this.gameTitle = element;
        break;
    }
  }

  private setupEventListeners(): void {
    this.startButton.addEventListener('click', () => {
      if (this.selectedGameMode && this.onGameSelected) {
        this.onGameSelected(this.selectedGameMode);
      }
    });
  }

  private loadAvailableGames(): void {
    const games = this.gameModeManager.getModesForUI();
    this.gamesContainer.innerHTML = '';

    games.forEach(game => {
      const gameCard = this.createGameCard(game);
      this.gamesContainer.appendChild(gameCard);
    });

    // Seleciona automaticamente o primeiro jogo se disponível
    if (games.length > 0) {
      this.selectGame(games[0].name);
    }
  }

  private createGameCard(game: {
    name: string;
    displayName: string;
    description: string;
    category: string;
    difficulty: string;
    bodyParts: string[];
  }): HTMLElement {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.gameMode = game.name;

    const difficultyClass = `difficulty-${game.difficulty}`;
    const categoryFormatted = this.formatCategory(game.category);
    const bodyPartsText = game.bodyParts.join(', ');

    card.innerHTML = `
      <div class="game-title">${game.displayName}</div>
      <div class="game-description">${game.description}</div>
      <div class="game-meta">
        <div>
          <span class="game-category">${categoryFormatted}</span>
        </div>
        <div class="game-difficulty ${difficultyClass}">
          ${this.formatDifficulty(game.difficulty)}
        </div>
      </div>
      <div style="margin-top: 10px; font-size: 0.85em; opacity: 0.8;">
        <strong>Corpo:</strong> ${bodyPartsText}
      </div>
    `;

    card.addEventListener('click', () => {
      this.selectGame(game.name);
    });

    return card;
  }

  private selectGame(gameName: string): void {
    // Remove seleção anterior
    const previousSelected = this.gamesContainer.querySelector('.game-card.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }

    // Adiciona seleção ao novo card
    const selectedCard = this.gamesContainer.querySelector(`[data-game-mode="${gameName}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }

    this.selectedGameMode = gameName;
    this.startButton.disabled = false;

    console.log(`Jogo selecionado: ${gameName}`);
  }

  private formatCategory(category: string): string {
    const categories = {
      'fitness': 'Fitness',
      'rehabilitation': 'Reabilitação',
      'entertainment': 'Entretenimento'
    };
    return categories[category as keyof typeof categories] || category;
  }

  private formatDifficulty(difficulty: string): string {
    const difficulties = {
      'easy': 'Fácil',
      'medium': 'Médio',
      'hard': 'Difícil'
    };
    return difficulties[difficulty as keyof typeof difficulties] || difficulty;
  }

  /**
   * Atualiza a lista de jogos disponíveis (útil se novos jogos forem registrados)
   */
  public refresh(): void {
    this.loadAvailableGames();
  }

  /**
   * Verifica se há jogos disponíveis
   */
  public hasGames(): boolean {
    return this.gameModeManager.getAvailableModes().length > 0;
  }

  /**
   * Retorna estatísticas dos jogos para debug
   */
  public getGameStatistics(): any {
    return this.gameModeManager.getStatistics();
  }
}