import * as THREE from "three";

/**
 * Interface que define a estrutura básica de um modo de jogo
 */
export interface GameMode {
  /** Nome único que identifica o modo de jogo */
  readonly name: string;

  /** Título amigável do jogo para exibição */
  readonly displayName: string;

  /** Descrição do jogo */
  readonly description: string;

  /**
   * Inicializa o modo de jogo com a cena 3D
   * @param scene - Cena Three.js onde os objetos do jogo serão adicionados
   */
  initialize(scene: THREE.Scene): void;

  /**
   * Cria um novo objetivo para o jogo
   * @returns Objetivo específico do jogo
   */
  createGoal(): any;

  /**
   * Verifica se o jogador atingiu o objetivo atual
   * @param landmarks - Pontos de referência da pose detectada
   * @param currentGoal - Objetivo atual do jogo
   * @returns true se o objetivo foi atingido
   */
  checkGoalAchieved(landmarks: any[], currentGoal: any): boolean;

  /**
   * Atualiza a visualização do objetivo na cena
   * @param goal - Objetivo atual a ser visualizado
   */
  updateGoalVisualization(goal: any): void;

  /**
   * Remove visualizações do objetivo da cena
   */
  clearGoalVisualization(): void;

  /**
   * Processa a pose detectada para este modo de jogo específico
   * @param landmarks - Pontos de referência da pose
   * @returns Dados processados da pose específicos do jogo
   */
  processPose(landmarks: any[]): any;

  /**
   * Limpa recursos e remove objetos da cena
   */
  cleanup(): void;

  /**
   * Configurações específicas do jogo (tempos, tolerâncias, etc.)
   */
  getGameConfig(): GameModeConfig;
}

/**
 * Configurações específicas de cada modo de jogo
 */
export interface GameModeConfig {
  /** Tempo em ms para aguardar antes de iniciar um novo objetivo */
  goalDelayTime: number;

  /** Tempo em ms para aguardar após completar um objetivo */
  goalCompletedDelay: number;

  /** Tolerância para detecção de poses (específico do jogo) */
  tolerance: number;

  /** Configurações visuais específicas */
  visualConfig?: {
    colors?: {
      primary: number;
      secondary: number;
      success: number;
      error: number;
    };
    sizes?: {
      goalSize: number;
      indicatorSize: number;
    };
  };
}

/**
 * Metadados para registro de modos de jogo
 */
export interface GameModeMetadata {
  name: string;
  displayName: string;
  description: string;
  category: 'fitness' | 'rehabilitation' | 'entertainment';
  difficulty: 'easy' | 'medium' | 'hard';
  bodyParts: string[];
  constructor: new () => GameMode;
}