import * as THREE from 'three';
import type { ShoulderAngles } from '../../exercise/automaticCalibration';
import type { Side } from '../../exercise/shoulderMotion';
import { avatarArm } from './avatarPose';

type ArmVisual = {
  upper: THREE.Mesh;
  lower: THREE.Mesh;
  elbow: THREE.Mesh;
  hand: THREE.Mesh;
  ring: THREE.Mesh;
  sphere: THREE.Mesh;
  glow: THREE.Mesh;
  color: THREE.MeshBasicMaterial;
  glowColor: THREE.MeshBasicMaterial;
};
export interface ShoulderSceneState {
  goalAngles: ShoulderAngles;
  angles: ShoulderAngles;
  now: number;
}
/** Cena privada do jogo; todos os recursos são criados e descartados pelo jogo. */
export class ShoulderScene {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 0.5, -0.5, 0.1, 10);
  private renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  private avatar = new THREE.Group();
  private bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xe4f4ff });
  private segmentGeometry = new THREE.CylinderGeometry(0.025, 0.025, 1, 16);
  private jointGeometry = new THREE.SphereGeometry(0.032, 20, 16);
  private headGeometry = new THREE.SphereGeometry(0.09, 24, 20);
  private goalGeometry = new THREE.SphereGeometry(0.03, 24, 16);
  private ringGeometry = new THREE.RingGeometry(0.038, 0.045, 48);
  private glowGeometry = new THREE.CircleGeometry(0.052, 32);
  private arms = new Map<Side, ArmVisual>();
  private observer: ResizeObserver;
  private container: HTMLElement;
  constructor(container: HTMLElement) {
    this.container = container;
    this.camera.position.z = 2;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.className = 'shoulder-game-canvas';
    container.append(this.renderer.domElement);
    this.scene.add(this.avatar);
    const head = new THREE.Mesh(this.headGeometry, this.bodyMaterial);
    head.position.set(0, 0.33, 0);
    this.avatar.add(head);
    this.addStaticSegment([0, 0.22], [0, -0.16]);
    this.addStaticSegment([-0.13, 0.14], [0.13, 0.14]);
    this.addStaticSegment([0, -0.16], [-0.12, -0.38]);
    this.addStaticSegment([0, -0.16], [0.12, -0.38]);
    for (const [side, tint] of [
      ['left', 0x39c8ff],
      ['right', 0xff6e89],
    ] as const) {
      const color = new THREE.MeshBasicMaterial({ color: tint });
      const glowColor = new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      const upper = new THREE.Mesh(this.segmentGeometry, this.bodyMaterial),
        lower = new THREE.Mesh(this.segmentGeometry, this.bodyMaterial);
      const elbow = new THREE.Mesh(this.jointGeometry, this.bodyMaterial),
        hand = new THREE.Mesh(this.jointGeometry, color);
      const ring = new THREE.Mesh(this.ringGeometry, color),
        sphere = new THREE.Mesh(this.goalGeometry, color),
        glow = new THREE.Mesh(this.glowGeometry, glowColor);
      this.avatar.add(upper, lower, elbow, hand, ring, sphere, glow);
      this.arms.set(side, {
        upper,
        lower,
        elbow,
        hand,
        ring,
        sphere,
        glow,
        color,
        glowColor,
      });
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }
  private segment(
    mesh: THREE.Mesh,
    a: readonly number[],
    b: readonly number[]
  ): void {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
    mesh.scale.y = Math.hypot(dx, dy);
    mesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  }
  private addStaticSegment(a: [number, number], b: [number, number]): void {
    const mesh = new THREE.Mesh(this.segmentGeometry, this.bodyMaterial);
    this.segment(mesh, a, b);
    this.avatar.add(mesh);
  }
  update(state: ShoulderSceneState): void {
    for (const side of ['left', 'right'] as const) {
      const arm = this.arms.get(side)!,
        current = avatarArm(side, state.angles[side]);
      const goal = avatarArm(side, state.goalAngles[side]);
      this.segment(arm.upper, current.shoulder, current.elbow);
      this.segment(arm.lower, current.elbow, current.hand);
      arm.elbow.position.set(...current.elbow, 0.02);
      arm.hand.position.set(...current.hand, 0.04);
      const phase = state.now / 650 + (side === 'left' ? 0 : Math.PI);
      const x = goal.hand[0] + Math.sin(phase) * 0.012,
        y = goal.hand[1] + 0.065 + Math.cos(phase) * 0.008;
      arm.ring.position.set(...goal.hand, 0.08);
      arm.glow.position.set(x, y, 0.09);
      arm.sphere.position.set(x, y, 0.1);
    }
    this.renderer.render(this.scene, this.camera);
  }
  private resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    const aspect = width / height;
    const viewHeight = Math.max(1.3, 1.3 / aspect);
    this.camera.left = (-aspect * viewHeight) / 2;
    this.camera.right = (aspect * viewHeight) / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    this.observer.disconnect();
    for (const arm of this.arms.values()) {
      arm.color.dispose();
      arm.glowColor.dispose();
    }
    this.bodyMaterial.dispose();
    this.segmentGeometry.dispose();
    this.jointGeometry.dispose();
    this.headGeometry.dispose();
    this.goalGeometry.dispose();
    this.ringGeometry.dispose();
    this.glowGeometry.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
