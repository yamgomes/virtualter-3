import * as THREE from "three";
import type { Goal } from "./goals";
import { createGoal } from "./goals";

export interface GoalBall {
  mesh: THREE.Mesh;
  targetAngle: number;
  isLeft: boolean;
  startPosition: THREE.Vector3;
  currentPosition: THREE.Vector3;
  speed: number;
}

export class GoalManager {
  private scene: THREE.Scene;
  private currentGoal: Goal | null = null;
  private goalBalls: GoalBall[] = [];
  private ballRadius = 0.2;
  private ballSpeed = 0.05; // Increased from 0.02
  private screenCenter = new THREE.Vector3(0, 0, 0);
  private ballDistance = 6; // Reduced from 8 for shorter travel distance
  private onGoalReached?: (goal: Goal) => void;
  private onGoalCompleted?: () => void;
  private isActive = false;
  private isCompleting = false; // Prevent multiple completions

  // Reuse geometry and materials to avoid disposal overhead
  private ballGeometry = new THREE.SphereGeometry(this.ballRadius, 16, 16);
  private leftMaterial = new THREE.MeshBasicMaterial({ color: 0xff4757 }); // Red
  private rightMaterial = new THREE.MeshBasicMaterial({ color: 0x3742fa }); // Blue

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public setCallbacks(onGoalReached?: (goal: Goal) => void, onGoalCompleted?: () => void): void {
    this.onGoalReached = onGoalReached;
    this.onGoalCompleted = onGoalCompleted;
  }

  public startNewGoal(): void {
    this.clearCurrentGoal();
    this.currentGoal = createGoal();
    this.createGoalBalls();
    this.isActive = true;
    this.isCompleting = false; // Reset completion flag
  }

  private clearCurrentGoal(): void {
    this.goalBalls.forEach(ball => {
      this.scene.remove(ball.mesh);
      // Don't dispose geometry and materials - we'll reuse them
    });
    this.goalBalls = [];
    this.isActive = false;
  }

  private createGoalBalls(): void {
    if (!this.currentGoal) return;

    // Create left arm ball
    const leftBall = new THREE.Mesh(this.ballGeometry, this.leftMaterial);

    // Create right arm ball
    const rightBall = new THREE.Mesh(this.ballGeometry, this.rightMaterial);

    // Calculate start positions based on goal angles
    const leftAngleRad = THREE.MathUtils.degToRad(this.currentGoal.leftArm);
    const rightAngleRad = THREE.MathUtils.degToRad(this.currentGoal.rightArm);

    // Position balls at the edge of screen in direction opposite to goal
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

    // Create goal ball objects
    const leftGoalBall: GoalBall = {
      mesh: leftBall,
      targetAngle: this.currentGoal.leftArm,
      isLeft: true,
      startPosition: leftStartPos.clone(),
      currentPosition: leftStartPos.clone(),
      speed: this.ballSpeed
    };

    const rightGoalBall: GoalBall = {
      mesh: rightBall,
      targetAngle: this.currentGoal.rightArm,
      isLeft: false,
      startPosition: rightStartPos.clone(),
      currentPosition: rightStartPos.clone(),
      speed: this.ballSpeed
    };

    this.goalBalls.push(leftGoalBall, rightGoalBall);
    this.scene.add(leftBall);
    this.scene.add(rightBall);
  }

  public update(): void {
    if (!this.isActive || this.goalBalls.length === 0) return;

    let allBallsReachedCenter = true;

    this.goalBalls.forEach(ball => {
      // Move ball toward center
      const direction = new THREE.Vector3()
        .subVectors(this.screenCenter, ball.currentPosition)
        .normalize();

      ball.currentPosition.add(direction.multiplyScalar(ball.speed));
      ball.mesh.position.copy(ball.currentPosition);

      // Check if ball reached center
      const distanceToCenter = ball.currentPosition.distanceTo(this.screenCenter);
      if (distanceToCenter > 0.3) { // Reduced from 0.5 for faster detection
        allBallsReachedCenter = false;
      }
    });

    // If all balls reached center, trigger goal evaluation
    if (allBallsReachedCenter && this.currentGoal && !this.isCompleting) {
      this.onGoalReached?.(this.currentGoal);
      this.isActive = false; // Stop updating until next goal
    }
  }

  public checkPlayerPose(landmarks: any[]): boolean {
    if (!this.currentGoal || !landmarks || landmarks.length < 17) return false;

    // Get arm landmarks
    const leftShoulder = landmarks[11];
    const leftWrist = landmarks[15];
    const rightShoulder = landmarks[12];
    const rightWrist = landmarks[16];

    // Calculate current arm angles
    const leftArmAngle = this.calculateArmAngle(leftShoulder, leftWrist, true);
    const rightArmAngle = this.calculateArmAngle(rightShoulder, rightWrist, false);

    // Check if arms match goal angles (with tolerance)
    const tolerance = 25; // Increased tolerance from 20 degrees for easier/faster completion
    const leftMatch = Math.abs(leftArmAngle - this.currentGoal.leftArm) < tolerance;
    const rightMatch = Math.abs(rightArmAngle - this.currentGoal.rightArm) < tolerance;

    return leftMatch && rightMatch;
  }

  private calculateArmAngle(shoulder: any, wrist: any, isLeft: boolean): number {
    const deltaX = wrist.x - shoulder.x;
    const deltaY = wrist.y - shoulder.y;

    // Calculate angle in degrees
    let angle = Math.atan2(-deltaY, isLeft ? -deltaX : deltaX) * 180 / Math.PI;

    // Normalize to 0-360 range
    if (angle < 0) angle += 360;

    // Convert to our goal system (0-180 from horizontal)
    if (angle > 180) angle = 360 - angle;

    return Math.max(0, Math.min(180, angle));
  }

  public completeGoal(): void {
    this.clearCurrentGoal();
    this.onGoalCompleted?.();
  }

  public getCurrentGoal(): Goal | null {
    return this.currentGoal;
  }

  public isGoalActive(): boolean {
    return this.isActive;
  }

  public dispose(): void {
    this.clearCurrentGoal();

    // Dispose shared resources
    this.ballGeometry.dispose();
    this.leftMaterial.dispose();
    this.rightMaterial.dispose();
  }
}