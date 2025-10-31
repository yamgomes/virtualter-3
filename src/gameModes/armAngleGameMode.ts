import * as THREE from "three";
import { BaseGameMode } from "../baseGameMode";
import type { GameModeConfig } from "../gameMode";
import type { Goal } from "../goals";
import { createGoal } from "../goals";

/**
 * Modo de jogo focado em ângulos dos braços
 * O jogador deve posicionar os braços nos ângulos indicados pelas esferas coloridas
 */
export class ArmAngleGameMode extends BaseGameMode {
  readonly name = "arm-angles";
  readonly displayName = "Ângulos dos Braços";
  readonly description = "Posicione seus braços nos ângulos indicados pelas esferas coloridas";

  private goalBalls: GoalBall[] = [];
  private ballRadius = 0.2;
  private ballSpeed = 0.05;
  private ballDistance = 6;
  private screenCenter = new THREE.Vector3(0, 0, 0);
  private isGoalActive = false;
  private isCompleting = false;

  // Materiais reutilizáveis
  private ballGeometry = new THREE.SphereGeometry(this.ballRadius, 16, 16);
  private leftMaterial = new THREE.MeshBasicMaterial({ color: 0xff4757 }); // Vermelho
  private rightMaterial = new THREE.MeshBasicMaterial({ color: 0x3742fa }); // Azul

  protected onCleanup(): void {
    this.clearGoalBalls();
    this.ballGeometry.dispose();
    this.leftMaterial.dispose();
    this.rightMaterial.dispose();
  }

  public createGoal(): Goal {
    return createGoal();
  }

  public updateGoalVisualization(goal: Goal): void {
    this.clearGoalBalls();
    this.createGoalBalls(goal);
    this.isGoalActive = true;
    this.isCompleting = false;
  }

  public clearGoalVisualization(): void {
    this.clearGoalBalls();
    this.isGoalActive = false;
  }

  public checkGoalAchieved(landmarks: any[], currentGoal: Goal): boolean {
    if (!this.isGoalActive || this.isCompleting || !landmarks || landmarks.length === 0) {
      return false;
    }

    // Verifica se as esferas chegaram ao centro
    const ballsReachedCenter = this.goalBalls.every(ball => {
      const distanceToCenter = ball.currentPosition.distanceTo(this.screenCenter);
      return distanceToCenter < 0.3;
    });

    if (!ballsReachedCenter) {
      return false;
    }

    // Verifica se o jogador está na pose correta
    const poseData = this.processPose(landmarks);
    if (!poseData.leftArm || !poseData.rightArm) {
      return false;
    }

    const config = this.getGameConfig();
    const leftMatch = this.isWithinTolerance(poseData.leftArm.angle, currentGoal.leftArm, config.tolerance);
    const rightMatch = this.isWithinTolerance(poseData.rightArm.angle, currentGoal.rightArm, config.tolerance);

    if (leftMatch && rightMatch && !this.isCompleting) {
      this.isCompleting = true;
      this.animateGoalCompletion();
      return true;
    }

    return false;
  }

  public processPose(landmarks: any[]): ArmPoseData {
    if (!landmarks || landmarks.length === 0) {
      return { leftArm: null, rightArm: null };
    }

    try {
      // Índices dos pontos de referência para MediaPipe Pose
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftElbow = landmarks[13];
      const rightElbow = landmarks[14];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];

      let leftArm = null;
      let rightArm = null;

      // Calcula ângulo do braço esquerdo
      if (leftShoulder && leftElbow && leftWrist) {
        const shoulderElbowAngle = this.calculateAngle(leftShoulder, leftElbow);
        const armAngle = this.normalizeAngle(Math.abs(shoulderElbowAngle));

        leftArm = {
          angle: armAngle,
          shoulder: leftShoulder,
          elbow: leftElbow,
          wrist: leftWrist
        };
      }

      // Calcula ângulo do braço direito
      if (rightShoulder && rightElbow && rightWrist) {
        const shoulderElbowAngle = this.calculateAngle(rightShoulder, rightElbow);
        const armAngle = this.normalizeAngle(Math.abs(shoulderElbowAngle));

        rightArm = {
          angle: armAngle,
          shoulder: rightShoulder,
          elbow: rightElbow,
          wrist: rightWrist
        };
      }

      return { leftArm, rightArm };
    } catch (error) {
      console.warn("Erro ao processar pose:", error);
      return { leftArm: null, rightArm: null };
    }
  }

  public getGameConfig(): GameModeConfig {
    return {
      goalDelayTime: 1000,
      goalCompletedDelay: 800,
      tolerance: 15, // Tolerância de 15 graus para ângulos
      visualConfig: {
        colors: {
          primary: 0xff4757,
          secondary: 0x3742fa,
          success: 0x2ed573,
          error: 0xff4757
        },
        sizes: {
          goalSize: this.ballRadius,
          indicatorSize: 0.1
        }
      }
    };
  }

  // Método para atualizar a animação das esferas (chamado no loop do jogo)
  public updateGoalAnimation(): void {
    if (!this.isGoalActive || this.goalBalls.length === 0) return;

    this.goalBalls.forEach(ball => {
      // Move a esfera em direção ao centro
      const direction = this.screenCenter.clone().sub(ball.currentPosition).normalize();
      const movement = direction.multiplyScalar(ball.speed);

      ball.currentPosition.add(movement);
      ball.mesh.position.copy(ball.currentPosition);
    });
  }

  private createGoalBalls(goal: Goal): void {
    if (!this.scene) return;

    // Cria esfera do braço esquerdo
    const leftBall = new THREE.Mesh(this.ballGeometry, this.leftMaterial);

    // Cria esfera do braço direito
    const rightBall = new THREE.Mesh(this.ballGeometry, this.rightMaterial);

    // Calcula posições iniciais baseadas nos ângulos objetivo
    const leftAngleRad = THREE.MathUtils.degToRad(goal.leftArm);
    const rightAngleRad = THREE.MathUtils.degToRad(goal.rightArm);

    const leftStartPos = new THREE.Vector3(
      -Math.cos(leftAngleRad) * this.ballDistance,
      Math.sin(leftAngleRad) * this.ballDistance,
      0
    );

    const rightStartPos = new THREE.Vector3(
      Math.cos(rightAngleRad) * this.ballDistance,
      Math.sin(rightAngleRad) * this.ballDistance,
      0
    );

    leftBall.position.copy(leftStartPos);
    rightBall.position.copy(rightStartPos);

    // Cria objetos de esfera
    const leftGoalBall: GoalBall = {
      mesh: leftBall,
      targetAngle: goal.leftArm,
      isLeft: true,
      startPosition: leftStartPos.clone(),
      currentPosition: leftStartPos.clone(),
      speed: this.ballSpeed
    };

    const rightGoalBall: GoalBall = {
      mesh: rightBall,
      targetAngle: goal.rightArm,
      isLeft: false,
      startPosition: rightStartPos.clone(),
      currentPosition: rightStartPos.clone(),
      speed: this.ballSpeed
    };

    this.goalBalls = [leftGoalBall, rightGoalBall];

    // Adiciona à cena
    this.scene.add(leftBall);
    this.scene.add(rightBall);
  }

  private clearGoalBalls(): void {
    if (!this.scene) return;

    this.goalBalls.forEach(ball => {
      this.scene!.remove(ball.mesh);
    });
    this.goalBalls = [];
  }

  private animateGoalCompletion(): void {
    // Anima as esferas para indicar sucesso
    this.goalBalls.forEach(ball => {
      const successMaterial = new THREE.MeshBasicMaterial({ color: 0x2ed573 });
      ball.mesh.material = successMaterial;

      // Pequena animação de escala
      const startScale = ball.mesh.scale.clone();
      const targetScale = startScale.clone().multiplyScalar(1.5);

      const animateScale = () => {
        ball.mesh.scale.lerp(targetScale, 0.1);
        if (ball.mesh.scale.length() < targetScale.length() * 0.95) {
          requestAnimationFrame(animateScale);
        }
      };
      animateScale();
    });
  }
}

// Interfaces específicas do jogo de ângulos
interface GoalBall {
  mesh: THREE.Mesh;
  targetAngle: number;
  isLeft: boolean;
  startPosition: THREE.Vector3;
  currentPosition: THREE.Vector3;
  speed: number;
}

interface ArmData {
  angle: number;
  shoulder: any;
  elbow: any;
  wrist: any;
}

interface ArmPoseData {
  leftArm: ArmData | null;
  rightArm: ArmData | null;
}