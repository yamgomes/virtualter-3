import type { GameMode, GameModeMetadata } from "./gameMode";
import { ArmAngleGameMode } from "./gameModes/armAngleGameMode";
import { SurfingGameMode } from "./gameModes/surfingGameMode";
import { SitStandGameMode } from "./gameModes/sitStandGameMode";
import { SwimmingGameMode } from "./gameModes/swimmingGameMode";

/**
 * Gerenciador central para todos os modos de jogo
 * Responsável por registrar, instanciar e alternar entre diferentes jogos
 */
export class GameModeManager {
  private static instance: GameModeManager;
  private registeredModes = new Map<string, GameModeMetadata>();
  private currentMode: GameMode | null = null;

  private constructor() {
    this.registerDefaultModes();
  }

  /**
   * Singleton - retorna a instância única do gerenciador
   */
  public static getInstance(): GameModeManager {
    if (!GameModeManager.instance) {
      GameModeManager.instance = new GameModeManager();
    }
    return GameModeManager.instance;
  }

  /**
   * Registra os modos de jogo padrão do sistema
   */
  private registerDefaultModes(): void {
    this.registerMode({
      name: "arm-angles",
      displayName: "Ângulos dos Braços",
      description: "Posicione seus braços nos ângulos indicados pelas esferas coloridas",
      category: "fitness",
      difficulty: "easy",
      bodyParts: ["braços", "ombros"],
      constructor: ArmAngleGameMode
    });

    // Registrar novos jogos (placeholder)
    this.registerMode({
      name: "surfing",
      displayName: "Simulador de Surfe",
      description: "Simule movimentos de surfe para manter o equilíbrio na prancha virtual",
      category: "entertainment",
      difficulty: "medium",
      bodyParts: ["corpo todo", "equilíbrio"],
      constructor: SurfingGameMode
    });

    this.registerMode({
      name: "sit-stand",
      displayName: "Sentar e Levantar",
      description: "Realize exercícios de sentar e levantar seguindo o ritmo indicado",
      category: "rehabilitation",
      difficulty: "easy",
      bodyParts: ["pernas", "quadris", "core"],
      constructor: SitStandGameMode
    });

    this.registerMode({
      name: "swimming",
      displayName: "Simulador de Natação",
      description: "Simule diferentes estilos de natação com movimentos coordenados",
      category: "fitness",
      difficulty: "hard",
      bodyParts: ["braços", "corpo todo", "coordenação"],
      constructor: SwimmingGameMode
    });
  }

  /**
   * Registra um novo modo de jogo
   */
  public registerMode(metadata: GameModeMetadata): void {
    if (this.registeredModes.has(metadata.name)) {
      console.warn(`Modo de jogo '${metadata.name}' já está registrado. Sobrescrevendo...`);
    }

    this.registeredModes.set(metadata.name, metadata);
    console.log(`Modo de jogo registrado: ${metadata.displayName}`);
  }

  /**
   * Remove um modo de jogo do registro
   */
  public unregisterMode(name: string): boolean {
    const removed = this.registeredModes.delete(name);
    if (removed) {
      console.log(`Modo de jogo '${name}' removido do registro`);
    }
    return removed;
  }

  /**
   * Retorna todos os modos de jogo registrados
   */
  public getAvailableModes(): GameModeMetadata[] {
    return Array.from(this.registeredModes.values());
  }

  /**
   * Retorna metadados de um modo específico
   */
  public getModeMetadata(name: string): GameModeMetadata | undefined {
    return this.registeredModes.get(name);
  }

  /**
   * Filtra modos por categoria
   */
  public getModesByCategory(category: 'fitness' | 'rehabilitation' | 'entertainment'): GameModeMetadata[] {
    return this.getAvailableModes().filter(mode => mode.category === category);
  }

  /**
   * Filtra modos por dificuldade
   */
  public getModesByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): GameModeMetadata[] {
    return this.getAvailableModes().filter(mode => mode.difficulty === difficulty);
  }

  /**
   * Cria uma instância do modo de jogo especificado
   */
  public createGameMode(name: string): GameMode | null {
    const metadata = this.registeredModes.get(name);
    if (!metadata) {
      console.error(`Modo de jogo '${name}' não encontrado`);
      return null;
    }

    try {
      const GameModeClass = metadata.constructor;
      return new GameModeClass();
    } catch (error) {
      console.error(`Erro ao criar instância do modo '${name}':`, error);
      return null;
    }
  }

  /**
   * Define o modo de jogo atual
   */
  public setCurrentMode(name: string): boolean {
    const newMode = this.createGameMode(name);
    if (!newMode) {
      return false;
    }

    // Limpa o modo anterior se existir
    if (this.currentMode) {
      this.currentMode.cleanup();
    }

    this.currentMode = newMode;
    console.log(`Modo de jogo atual alterado para: ${name}`);
    return true;
  }

  /**
   * Retorna o modo de jogo atual
   */
  public getCurrentMode(): GameMode | null {
    return this.currentMode;
  }

  /**
   * Verifica se um modo está disponível
   */
  public isModeAvailable(name: string): boolean {
    return this.registeredModes.has(name);
  }

  /**
   * Retorna informações resumidas de todos os modos para UI
   */
  public getModesForUI(): Array<{
    name: string;
    displayName: string;
    description: string;
    category: string;
    difficulty: string;
    bodyParts: string[];
  }> {
    return this.getAvailableModes().map(mode => ({
      name: mode.name,
      displayName: mode.displayName,
      description: mode.description,
      category: mode.category,
      difficulty: mode.difficulty,
      bodyParts: mode.bodyParts
    }));
  }

  /**
   * Limpa o modo atual e libera recursos
   */
  public cleanup(): void {
    if (this.currentMode) {
      this.currentMode.cleanup();
      this.currentMode = null;
    }
  }

  /**
   * Reinicia o gerenciador (útil para testes)
   */
  public reset(): void {
    this.cleanup();
    this.registeredModes.clear();
    this.registerDefaultModes();
  }

  /**
   * Retorna estatísticas dos modos registrados
   */
  public getStatistics(): {
    totalModes: number;
    byCategory: Record<string, number>;
    byDifficulty: Record<string, number>;
  } {
    const modes = this.getAvailableModes();

    const byCategory = modes.reduce((acc, mode) => {
      acc[mode.category] = (acc[mode.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byDifficulty = modes.reduce((acc, mode) => {
      acc[mode.difficulty] = (acc[mode.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalModes: modes.length,
      byCategory,
      byDifficulty
    };
  }
}