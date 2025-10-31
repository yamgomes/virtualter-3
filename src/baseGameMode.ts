import * as THREE from "three";
import type { GameMode, GameModeConfig } from "./gameMode";

/**
 * Classe base abstrata que implementa funcionalidades comuns
 * para todos os modos de jogo
 */
export abstract class BaseGameMode implements GameMode {
  public scene?: THREE.Scene;
  protected goalObjects: THREE.Object3D[] = [];
  protected isInitialized = false;

  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly description: string;

  /**
   * Inicializa o modo de jogo com a cena
   */
  public initialize(scene: THREE.Scene): void {
    if (this.isInitialized) {
      this.cleanup();
    }

    this.scene = scene;
    this.isInitialized = true;
    this.onInitialize();
  }

  /**
   * Hook para implementações específicas de inicialização
   */
  protected onInitialize(): void {
    // Implementação padrão vazia - pode ser sobrescrita
  }

  /**
   * Limpa todos os recursos e objetos da cena
   */
  public cleanup(): void {
    this.clearGoalVisualization();
    this.onCleanup();
    this.isInitialized = false;
  }

  /**
   * Hook para limpeza específica do modo de jogo
   */
  protected onCleanup(): void {
    // Implementação padrão vazia - pode ser sobrescrita
  }

  /**
   * Remove todas as visualizações de objetivo da cena
   */
  public clearGoalVisualization(): void {
    if (!this.scene) return;

    this.goalObjects.forEach(obj => {
      this.scene!.remove(obj);
      this.disposeObject(obj);
    });
    this.goalObjects = [];
  }

  /**
   * Adiciona um objeto à lista de objetos de objetivo
   */
  protected addGoalObject(object: THREE.Object3D): void {
    if (!this.scene) return;

    this.goalObjects.push(object);
    this.scene.add(object);
  }

  /**
   * Remove completamente um objeto 3D e seus recursos
   */
  protected disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  /**
   * Verifica se dois valores estão dentro de uma tolerância
   */
  public isWithinTolerance(value1: number, value2: number, tolerance: number): boolean {
    return Math.abs(value1 - value2) <= tolerance;
  }

  /**
   * Calcula o ângulo entre dois pontos em relação ao eixo horizontal
   */
  public calculateAngle(point1: any, point2: any): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  /**
   * Normaliza um ângulo para estar entre 0 e 360 graus
   */
  public normalizeAngle(angle: number): number {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  }

  /**
   * Converte coordenadas de pose normalizadas para coordenadas de tela
   */
  protected poseToScreenCoords(poseX: number, poseY: number): { x: number; y: number } {
    // As coordenadas de pose vêm normalizadas (0-1)
    // Converte para coordenadas de tela 3D
    const screenX = (poseX - 0.5) * 10; // Ajusta a escala conforme necessário
    const screenY = (0.5 - poseY) * 7.5; // Inverte Y e ajusta escala

    return { x: screenX, y: screenY };
  }

  /**
   * Cria uma esfera básica para visualizações
   */
  protected createSphere(radius: number, color: number, position?: THREE.Vector3): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color });
    const sphere = new THREE.Mesh(geometry, material);

    if (position) {
      sphere.position.copy(position);
    }

    return sphere;
  }

  /**
   * Cria um cubo básico para visualizações
   */
  protected createCube(size: number, color: number, position?: THREE.Vector3): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshBasicMaterial({ color });
    const cube = new THREE.Mesh(geometry, material);

    if (position) {
      cube.position.copy(position);
    }

    return cube;
  }

  // Métodos abstratos que devem ser implementados pelas classes filhas
  abstract createGoal(): any;
  abstract checkGoalAchieved(landmarks: any[], currentGoal: any): boolean;
  abstract updateGoalVisualization(goal: any): void;
  abstract processPose(landmarks: any[]): any;
  abstract getGameConfig(): GameModeConfig;
}