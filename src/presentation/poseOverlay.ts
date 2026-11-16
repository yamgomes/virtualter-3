import * as THREE from 'three';
import type { LandmarkName, PoseFrame } from '../tracking/types';
import type { BilateralCalibration, ShoulderValues } from '../exercise/automaticCalibration';
import type { Side } from '../exercise/shoulderMotion';
import { targetPosition } from './targetPosition';

const connections: [LandmarkName, LandmarkName][] = [
  ['leftShoulder', 'rightShoulder'], ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'], ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'], ['leftHip', 'rightHip'], ['leftHip', 'leftKnee'],
  ['rightHip', 'rightKnee'], ['leftKnee', 'leftAnkle'], ['rightKnee', 'rightAnkle'],
];
const names = [...new Set<LandmarkName>(connections.flat()), 'nose' as LandmarkName];
export interface GameTargets { calibration: BilateralCalibration; targets: ShoulderValues; remaining: number }

/** Renderiza o esqueleto e os alvos dentro do retângulo espelhado da câmera. */
export class PoseOverlay {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
  private renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  private geometry = new THREE.SphereGeometry(0.008, 12, 12);
  private material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  private joints = new Map<LandmarkName, THREE.Mesh>();
  private lines: THREE.Line[] = [];
  private goalGeometry = new THREE.SphereGeometry(0.03, 24, 16);
  private ringGeometry = new THREE.RingGeometry(0.040, 0.046, 48);
  private glowGeometry = new THREE.CircleGeometry(0.052, 32);
  private goalObjects = new Map<Side, { sphere: THREE.Mesh; ring: THREE.Mesh; glow: THREE.Mesh; material: THREE.MeshBasicMaterial; glowMaterial: THREE.MeshBasicMaterial }>();
  private observer: ResizeObserver;
  private container: HTMLElement;
  constructor(container: HTMLElement) {
    this.container = container;
    this.camera.position.z = 2;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.className = 'pose-overlay';
    container.append(this.renderer.domElement);
    for (const name of names) {
      const joint = new THREE.Mesh(this.geometry, this.material); joint.visible = false;
      this.joints.set(name, joint); this.scene.add(joint);
    }
    for (const _connection of connections) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geometry, this.lineMaterial); line.visible = false;
      this.lines.push(line); this.scene.add(line);
    }
    for (const [side, color] of [['left', 0x39c8ff], ['right', 0xff6e89]] as const) {
      const material = new THREE.MeshBasicMaterial({ color });
      const glowMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false });
      const sphere = new THREE.Mesh(this.goalGeometry, material);
      const ring = new THREE.Mesh(this.ringGeometry, material);
      const glow = new THREE.Mesh(this.glowGeometry, glowMaterial);
      sphere.visible = ring.visible = glow.visible = false;
      this.scene.add(sphere, ring, glow); this.goalObjects.set(side, { sphere, ring, glow, material, glowMaterial });
    }
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    this.resize();
  }
  update(frame: PoseFrame | null, game: GameTargets | null = null): void {
    const aspect = frame?.aspectRatio ?? 1;
    this.camera.left = -aspect / 2; this.camera.right = aspect / 2; this.camera.updateProjectionMatrix();
    for (const [name, joint] of this.joints) {
      const point = frame?.points[name]; joint.visible = !!point;
      if (point) joint.position.set((0.5 - point.x) * aspect, 0.5 - point.y, 0);
    }
    connections.forEach(([a, b], index) => {
      const start = this.joints.get(a)!, end = this.joints.get(b)!, line = this.lines[index];
      line.visible = start.visible && end.visible;
      if (line.visible) {
        const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
        positions.setXYZ(0, start.position.x, start.position.y, 0);
        positions.setXYZ(1, end.position.x, end.position.y, 0);
        positions.needsUpdate = true; line.geometry.computeBoundingSphere();
      }
    });
    for (const side of ['left', 'right'] as const) {
      const objects = this.goalObjects.get(side)!;
      const target = frame && game ? targetPosition(frame, game.calibration, game.targets, side) : null;
      objects.sphere.visible = objects.ring.visible = objects.glow.visible = !!target;
      if (!target || !game) continue;
      const remaining = THREE.MathUtils.clamp(game.remaining, 0, 1);
      const startX = THREE.MathUtils.clamp(target.x + (side === 'left' ? -0.35 : 0.35), -aspect / 2 + 0.05, aspect / 2 - 0.05);
      const startY = THREE.MathUtils.clamp(target.y + 0.22, -0.45, 0.45);
      const x = THREE.MathUtils.lerp(target.x, startX, remaining);
      const y = THREE.MathUtils.lerp(target.y, startY, remaining);
      objects.ring.position.set(target.x, target.y, 0.08);
      objects.glow.position.set(x, y, 0.09);
      objects.sphere.position.set(x, y, 0.1);
    }
    this.renderer.render(this.scene, this.camera);
  }
  private resize(): void {
    this.renderer.setSize(this.container.clientWidth || 1, this.container.clientHeight || 1, false);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    this.observer.disconnect(); this.lines.forEach(line => line.geometry.dispose());
    for (const objects of this.goalObjects.values()) { objects.material.dispose(); objects.glowMaterial.dispose(); }
    this.geometry.dispose(); this.material.dispose(); this.lineMaterial.dispose(); this.goalGeometry.dispose(); this.ringGeometry.dispose(); this.glowGeometry.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
