import * as THREE from 'three';
import type { LandmarkName, PoseFrame } from '../tracking/types';
const connections: [LandmarkName, LandmarkName][] = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'],
  ['rightHip', 'rightKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightKnee', 'rightAnkle'],
];
/** Apenas a prévia comum de rastreamento durante preparação e calibração. */
export class PoseOverlay {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 0.5, -0.5, 0.1, 10);
  private renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  private pointGeometry = new THREE.SphereGeometry(0.008, 12, 12);
  private pointMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
  });
  private joints = new Map<LandmarkName, THREE.Mesh>();
  private lines: THREE.Line[] = [];
  private observer: ResizeObserver;
  private container: HTMLElement;
  constructor(container: HTMLElement) {
    this.container = container;
    this.camera.position.z = 2;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.className = 'pose-overlay';
    container.append(this.renderer.domElement);
    const names = [
      ...new Set<LandmarkName>(connections.flat()),
      'nose' as LandmarkName,
    ];
    for (const name of names) {
      const joint = new THREE.Mesh(this.pointGeometry, this.pointMaterial);
      joint.visible = false;
      this.joints.set(name, joint);
      this.scene.add(joint);
    }
    for (const _connection of connections) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(6), 3)
      );
      const line = new THREE.Line(geometry, this.lineMaterial);
      line.visible = false;
      this.lines.push(line);
      this.scene.add(line);
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }
  setVisible(visible: boolean): void {
    this.renderer.domElement.hidden = !visible;
  }
  update(frame: PoseFrame | null): void {
    const aspect =
      frame?.aspectRatio ??
      this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.camera.left = -aspect / 2;
    this.camera.right = aspect / 2;
    this.camera.updateProjectionMatrix();
    for (const [name, joint] of this.joints) {
      const point = frame?.points[name];
      joint.visible = !!point;
      if (point) joint.position.set((0.5 - point.x) * aspect, 0.5 - point.y, 0);
    }
    connections.forEach(([a, b], index) => {
      const start = this.joints.get(a)!,
        end = this.joints.get(b)!,
        line = this.lines[index];
      line.visible = start.visible && end.visible;
      if (line.visible) {
        const positions = line.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        positions.setXYZ(0, start.position.x, start.position.y, 0);
        positions.setXYZ(1, end.position.x, end.position.y, 0);
        positions.needsUpdate = true;
        line.geometry.computeBoundingSphere();
      }
    });
    this.renderer.render(this.scene, this.camera);
  }
  private resize(): void {
    this.renderer.setSize(
      this.container.clientWidth || 1,
      this.container.clientHeight || 1,
      false
    );
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    this.observer.disconnect();
    this.lines.forEach((line) => line.geometry.dispose());
    this.pointGeometry.dispose();
    this.pointMaterial.dispose();
    this.lineMaterial.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
