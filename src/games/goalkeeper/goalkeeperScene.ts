import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import playerUrl from '../../../assets/models/female_football_player.glb?url';
import goalUrl from '../../../assets/models/football_gates.glb?url';
import ballUrl from '../../../assets/models/low_poly_footballsoccer_ball.glb?url';
import gloveUrl from '../../../assets/models/low_poly_gloved_hand.glb?url';
import type { ShoulderAngles } from '../../exercise/automaticCalibration';
import { avatarArm } from '../shoulder/avatarPose';
import type { Shot } from './goalkeeperGame';

const SIDES = ['left', 'right'] as const;
const GROUND = -0.44;

function mesh(geometry: THREE.BufferGeometry, color: number) {
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
}

function fit(model: THREE.Object3D, axis: 'x' | 'y', size: number, grounded = false) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  if (grounded) center.y = box.min.y;
  const scale = size / box.getSize(new THREE.Vector3())[axis];
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  model.position.sub(center);
  group.add(model);
  return group;
}

function dispose(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) {
    if (typeof ImageBitmap !== 'undefined' && texture.source.data instanceof ImageBitmap)
      texture.source.data.close();
    texture.dispose();
  }
  for (const skeleton of skeletons) skeleton.dispose();
}

export class GoalkeeperScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 0.6, -0.6, 0.1, 10);
  private readonly renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  private readonly loader = new GLTFLoader();
  private readonly goal = new THREE.Group();
  private readonly player = new THREE.Group();
  private readonly ball = new THREE.Group();
  private readonly gloves = { left: new THREE.Group(), right: new THREE.Group() };
  private readonly marker = new THREE.Mesh(
    new THREE.RingGeometry(0.063, 0.076, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd866 })
  );
  private readonly observer: ResizeObserver;
  private readonly stage: HTMLElement;
  private disposed = false;

  constructor(stage: HTMLElement) {
    this.stage = stage;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.className = 'goalkeeper-canvas';
    stage.classList.add('goalkeeper-stage');
    stage.append(this.renderer.domElement);
    this.camera.position.set(0, 0.08, 3);
    const light = new THREE.DirectionalLight(0xffffff, 2.3);
    light.position.set(1, 2, 3);
    const fill = new THREE.DirectionalLight(0xe4f0ff, 0.7);
    fill.position.set(-2, 1, 2);
    this.scene.add(new THREE.HemisphereLight(0xe1f1ff, 0x9cb49d, 2), light, fill);

    const post = mesh(new THREE.BoxGeometry(0.026, 0.99, 0.035), 0xffffff);
    post.position.set(-0.84, 0.49, 0);
    const rightPost = post.clone();
    rightPost.position.x = 0.84;
    const crossbar = mesh(new THREE.BoxGeometry(1.7, 0.028, 0.035), 0xffffff);
    crossbar.position.y = 0.99;
    this.goal.add(post, rightPost, crossbar);
    this.goal.position.set(0, GROUND, -0.3);

    const body = mesh(new THREE.CapsuleGeometry(0.1, 0.48, 4, 12), 0x104675);
    body.position.y = 0.37;
    const head = mesh(new THREE.SphereGeometry(0.092, 16, 12), 0xf5bf93);
    head.position.y = 0.86;
    this.player.add(body, head);
    this.player.position.set(0, GROUND, -0.09);
    this.ball.add(mesh(new THREE.SphereGeometry(0.052, 16, 12), 0xfff9e5));
    this.gloves.left.add(mesh(new THREE.SphereGeometry(0.055, 16, 12), 0x3acaff));
    this.gloves.right.add(mesh(new THREE.SphereGeometry(0.055, 16, 12), 0xff777f));
    this.scene.add(this.goal, this.player, this.ball, this.gloves.left, this.gloves.right, this.marker);
    this.ball.visible = this.marker.visible = false;

    void this.load(goalUrl, (model) => this.replace(this.goal, fit(model, 'x', 1.7, true)));
    void this.load(playerUrl, (model) => this.replace(this.player, fit(model, 'y', 0.95, true)));
    void this.load(ballUrl, (model) => this.replace(this.ball, fit(model, 'y', 0.104)));
    void this.load(gloveUrl, (model) => {
      const mirrored = fit(clone(model), 'y', 0.15);
      mirrored.scale.x *= -1;
      this.replace(this.gloves.left, mirrored);
      this.replace(this.gloves.right, fit(model, 'y', 0.15));
    });

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(stage);
    this.resize();
  }

  private async load(url: string, use: (model: THREE.Group) => void): Promise<void> {
    try {
      const { scene } = await this.loader.loadAsync(url);
      if (this.disposed) dispose(scene);
      else use(scene);
    } catch (error) {
      console.warn('Modelo do goleiro indisponível:', error);
    }
  }

  private replace(container: THREE.Group, model: THREE.Object3D): void {
    dispose(container);
    container.clear();
    container.add(model);
  }

  private resize(): void {
    const width = this.stage.clientWidth || 1;
    const height = this.stage.clientHeight || 1;
    const aspect = width / height;
    const viewHeight = Math.max(1.28, 1.96 / aspect);
    this.camera.left = -viewHeight * aspect / 2;
    this.camera.right = viewHeight * aspect / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(angles: ShoulderAngles, shot: Shot | null, progress: number, now: number): void {
    for (const side of SIDES) {
      const pose = avatarArm(side, angles[side]);
      const glove = this.gloves[side];
      glove.position.set(...pose.hand, 0.02);
      glove.rotation.z = Math.atan2(pose.hand[1] - pose.elbow[1], pose.hand[0] - pose.elbow[0]) - Math.PI / 2;
    }
    this.ball.visible = this.marker.visible = shot !== null;
    if (shot) {
      const [x, y] = avatarArm(shot.side, shot.degrees).hand;
      this.marker.position.set(x, y, -0.015);
      this.marker.scale.setScalar(1 + (1 - progress) * 0.32);
      this.ball.position.set(x * progress, THREE.MathUtils.lerp(0.52, y, progress), 1 - progress);
      this.ball.scale.setScalar(1.55 - progress * 0.55);
      this.ball.rotation.set(now / 440, now / 610, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.observer.disconnect();
    dispose(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.stage.classList.remove('goalkeeper-stage');
  }
}
