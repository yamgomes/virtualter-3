import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import playerUrl from '../../../assets/models/female_football_player.glb?url';
import goalUrl from '../../../assets/models/football_gates.glb?url';
import ballUrl from '../../../assets/models/low_poly_footballsoccer_ball.glb?url';
import gloveUrl from '../../../assets/models/low_poly_gloved_hand.glb?url';
import type { ShoulderAngles } from '../../exercise/automaticCalibration';
import type { Side } from '../../exercise/shoulderMotion';
import { avatarArm } from '../shoulder/avatarPose';
import type { Shot } from './goalkeeperGame';
import { dispose, fit, mesh } from '../sceneModels';

const SIDES = ['left', 'right'] as const;
const GROUND = -0.44;
const PLAYER_HEIGHT = 0.95;
// A linha dos ombros da camisa fica a cerca de 79% da altura do modelo.
const SHOULDER_HEIGHT = GROUND + PLAYER_HEIGHT * 0.79;
const GOAL_HEIGHT = 1.24;

function glovePose(side: Side, degrees: number) {
  const { shoulder, elbow, hand } = avatarArm(side, degrees);
  return {
    x: hand[0],
    y: SHOULDER_HEIGHT + hand[1] - shoulder[1],
    rotation: Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]) - Math.PI / 2,
  };
}

export class GoalkeeperScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(
    -1,
    1,
    0.6,
    -0.6,
    0.1,
    10
  );
  private readonly renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
  });
  private readonly loader = new GLTFLoader();
  private readonly goal = new THREE.Group();
  private readonly player = new THREE.Group();
  private readonly balls = [new THREE.Group(), new THREE.Group()];
  private readonly gloves = {
    left: new THREE.Group(),
    right: new THREE.Group(),
  };
  private readonly markers = this.balls.map(
    () =>
      new THREE.Mesh(
        new THREE.RingGeometry(0.063, 0.076, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd866 })
      )
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
    this.scene.add(
      new THREE.HemisphereLight(0xe1f1ff, 0x9cb49d, 2),
      light,
      fill
    );

    const post = mesh(
      new THREE.BoxGeometry(0.026, GOAL_HEIGHT, 0.035),
      0xffffff
    );
    post.position.set(-0.84, GOAL_HEIGHT / 2, 0);
    const rightPost = post.clone();
    rightPost.position.x = 0.84;
    const crossbar = mesh(new THREE.BoxGeometry(1.7, 0.028, 0.035), 0xffffff);
    crossbar.position.y = GOAL_HEIGHT;
    this.goal.add(post, rightPost, crossbar);
    this.goal.position.set(0, GROUND, -0.3);

    const body = mesh(new THREE.CapsuleGeometry(0.1, 0.48, 4, 12), 0x104675);
    body.position.y = 0.37;
    const head = mesh(new THREE.SphereGeometry(0.092, 16, 12), 0xf5bf93);
    head.position.y = 0.86;
    this.player.add(body, head);
    this.player.position.set(0, GROUND, -0.09);
    for (const ball of this.balls) {
      ball.add(mesh(new THREE.SphereGeometry(0.052, 16, 12), 0xfff9e5));
      ball.visible = false;
    }
    for (const marker of this.markers) marker.visible = false;
    this.gloves.left.add(
      mesh(new THREE.SphereGeometry(0.055, 16, 12), 0x3acaff)
    );
    this.gloves.right.add(
      mesh(new THREE.SphereGeometry(0.055, 16, 12), 0xff777f)
    );
    this.scene.add(
      this.goal,
      this.player,
      this.gloves.left,
      this.gloves.right,
      ...this.balls,
      ...this.markers
    );

    void this.load(goalUrl, (model) =>
      this.replace(this.goal, fit(model, 'x', 1.7, true))
    );
    void this.load(playerUrl, (model) =>
      this.replace(this.player, fit(model, 'y', PLAYER_HEIGHT, true))
    );
    void this.load(ballUrl, (model) => {
      const fitted = fit(model, 'y', 0.104);
      this.replace(this.balls[0], fitted);
      this.replace(this.balls[1], fitted.clone());
    });
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

  private async load(
    url: string,
    use: (model: THREE.Group) => void
  ): Promise<void> {
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
    const viewHeight = Math.max(1.52, 1.96 / aspect);
    this.camera.left = (-viewHeight * aspect) / 2;
    this.camera.right = (viewHeight * aspect) / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(angles: ShoulderAngles, shots: readonly Shot[], now: number): void {
    for (const side of SIDES) {
      const pose = glovePose(side, angles[side]);
      const glove = this.gloves[side];
      glove.position.set(pose.x, pose.y, 0.02);
      glove.rotation.z = pose.rotation;
    }
    this.balls.forEach((ball, index) => {
      const shot = shots[index];
      const marker = this.markers[index];
      ball.visible = marker.visible = !!shot;
      if (!shot) return;
      const { progress } = shot;
      const { x, y } = glovePose(shot.side, shot.degrees);
      marker.position.set(x, y, -0.015);
      marker.scale.setScalar(1 + (1 - progress) * 0.32);
      ball.position.set(
        x * progress,
        THREE.MathUtils.lerp(0.52, y, progress),
        1 - progress
      );
      ball.scale.setScalar(1.55 - progress * 0.55);
      ball.rotation.set(now / 440, now / 610, 0);
    });
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
