import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import ballUrl from '../../../assets/models/low_poly_footballsoccer_ball.glb?url';
import { dispose, fit, mesh } from '../sceneModels';
import { LEGS } from './legTracking';
import type { KneeLevels, Leg } from './legTracking';
import type { LowerBodyGame } from './lowerBodyGame';

const HIP_HEIGHT = 0.88;
const LEG_LENGTH = 0.41;
const LEG_OFFSET = { left: 0.13, right: -0.13 };
const CONTACT_HEIGHT = 0.77;
const BALL_RADIUS = 0.105;
const TRACK_SPACING = 1.4;

export class LowerBodyScene {
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 65);
  private readonly avatar = new THREE.Group();
  private readonly limbs = {
    left: this.createLimbs('left'),
    right: this.createLimbs('right'),
  };
  private readonly ball = new THREE.Group();
  private readonly marker = mesh(
    new THREE.TorusGeometry(0.15, 0.012, 8, 40),
    0xa5bbb6
  );
  private readonly trackMarks: THREE.Mesh[] = [];
  private readonly observer: ResizeObserver;
  private readonly stage: HTMLElement;
  private readonly mode: 'kneeJuggle' | 'walking';
  private disposed = false;
  private distance = 0;
  private previousTime: number | null = null;

  constructor(stage: HTMLElement, mode: 'kneeJuggle' | 'walking') {
    this.stage = stage;
    this.mode = mode;
    const walking = this.mode === 'walking';
    this.scene.background = new THREE.Color(walking ? 0xc3dfdb : 0x9fc37a);
    this.scene.fog = new THREE.Fog(this.scene.background, 9, 27);
    this.scene.add(new THREE.HemisphereLight(0xf1fbff, 0x50655a, 2.4));
    const light = new THREE.DirectionalLight(0xffebc7, 2);
    light.position.set(2, 5, walking ? -3 : 4);
    this.scene.add(light);
    this.avatar.position.y = HIP_HEIGHT;
    const jersey = mesh(new THREE.CapsuleGeometry(0.19, 0.27, 6, 12), 0x17766b);
    jersey.scale.z = 0.62;
    jersey.position.y = 0.24;
    const head = mesh(new THREE.SphereGeometry(0.125, 16, 12), 0xb67c5c);
    head.position.y = 0.68;
    const hair = mesh(
      new THREE.SphereGeometry(0.126, 16, 12, 0, Math.PI * 2, 0, 1.18),
      0x243337
    );
    hair.position.copy(head.position);
    this.avatar.add(jersey, head, hair);
    this.scene.add(this.avatar);

    const floor = mesh(
      new THREE.PlaneGeometry(80, 80),
      walking ? 0x749682 : 0x68974a
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    if (walking) {
      const path = mesh(new THREE.PlaneGeometry(2.2, 80), 0xd0b990);
      path.rotation.x = -Math.PI / 2;
      path.position.y = 0.004;
      this.scene.add(path);
      for (const x of [-1, 1]) {
        const edge = mesh(new THREE.PlaneGeometry(0.033, 80), 0xf1e0b5);
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(x, 0.009, 0);
        this.scene.add(edge);
      }
      for (let i = 0; i < 23; i++) {
        const mark = mesh(new THREE.PlaneGeometry(0.045, 0.42), 0xf1e0b5);
        mark.rotation.x = -Math.PI / 2;
        mark.position.y = 0.009;
        this.trackMarks.push(mark);
        this.scene.add(mark);
      }
      this.camera.position.set(0, 2.25, -4);
      this.camera.lookAt(0, 0.95, 2.1);
    } else {
      this.camera.position.set(0, 1.22, 3.6);
      this.camera.lookAt(0, 1.12, 0);
      this.addFieldBackdrop(floor.material);
      this.ball.add(
        mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 16), 0xfdf3d7)
      );
      this.scene.add(this.ball, this.marker);
      void this.loadBall();
    }
    const canvas = this.renderer.domElement;
    canvas.className = 'lower-body-canvas';
    canvas.classList.toggle(
      'lower-body-canvas--mirrored',
      mode === 'kneeJuggle'
    );
    canvas.setAttribute(
      'aria-label',
      walking ? 'Personagem na faixa central' : 'Bola e marca de contato'
    );
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.stage.append(canvas);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.stage);
    this.resize();
  }

  private addFieldBackdrop(ground: THREE.MeshStandardMaterial): void {
    const dome = new THREE.SphereGeometry(52, 24, 24);
    const vertices = dome.getAttribute('position');
    const horizon = new THREE.Color(0xbadff6);
    const blue = new THREE.Color(0x438fdc);
    const tint = new THREE.Color();
    const colors: number[] = [];
    for (let i = 0; i < vertices.count; i++) {
      const height = THREE.MathUtils.smoothstep(vertices.getY(i), 0, 18);
      tint.copy(horizon).lerp(blue, height);
      colors.push(tint.r, tint.g, tint.b);
    }
    dome.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(
      dome,
      new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        vertexColors: true,
        fog: false,
      })
    );
    this.scene.add(sky);

    const cloudShape = new THREE.SphereGeometry(1, 16, 12);
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xf3f8fc,
      fog: false,
    });
    const clouds = [
      [-6, 5.6, -21, 1],
      [6, 4.4, -25, 0.8],
    ];
    const puffs = [
      [-1.2, 0, 1.2, 0.35],
      [0, 0.3, 1.8, 0.6],
      [1.35, 0, 1.2, 0.4],
    ];
    for (const [x, y, z, size] of clouds) {
      const cloud = new THREE.Group();
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(size);
      for (const [offset, height, width, radius] of puffs) {
        const puff = new THREE.Mesh(cloudShape, cloudMaterial);
        puff.position.set(offset, height, 0);
        puff.scale.set(width, radius, 0.65);
        cloud.add(puff);
      }
      this.scene.add(cloud);
    }

    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const context = tile.getContext('2d');
    if (!context) return;
    context.fillStyle = '#eee';
    context.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1800; i++) {
      context.fillStyle = i % 2 ? '#fff' : '#aaa';
      const x = Math.random() * tile.width;
      const y = Math.random() * tile.height;
      context.fillRect(x, y, 1, 2);
    }
    const grass = new THREE.CanvasTexture(tile);
    grass.colorSpace = THREE.SRGBColorSpace;
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
    grass.repeat.set(32, 32);
    grass.anisotropy = Math.min(
      4,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    ground.map = grass;
  }

  private createLimbs(side: Leg) {
    const thigh = new THREE.Group();
    thigh.position.x = LEG_OFFSET[side];
    const upperLeg = mesh(
      new THREE.CapsuleGeometry(0.068, LEG_LENGTH - 0.13, 4, 10),
      0x263d4d
    );
    upperLeg.position.y = -LEG_LENGTH / 2;
    const shin = new THREE.Group();
    shin.position.y = -LEG_LENGTH;
    const lowerLeg = mesh(
      new THREE.CapsuleGeometry(0.052, LEG_LENGTH - 0.1, 4, 10),
      0x354f61
    );
    lowerLeg.position.y = -LEG_LENGTH / 2;
    const shoe = mesh(new THREE.BoxGeometry(0.13, 0.085, 0.23), 0xf7e6bd);
    shoe.position.set(0, -LEG_LENGTH, 0.052);
    shin.add(lowerLeg, shoe);
    thigh.add(upperLeg, shin);
    const arm = new THREE.Group();
    arm.position.set(side === 'left' ? 0.23 : -0.23, 0.43, 0);
    arm.rotation.z = Math.sign(arm.position.x) * 0.12;
    const sleeve = mesh(
      new THREE.CapsuleGeometry(0.051, 0.31, 4, 10),
      0x288d7d
    );
    sleeve.position.y = -0.15;
    const hand = mesh(new THREE.SphereGeometry(0.048, 10, 8), 0xb67c5c);
    hand.position.y = -0.36;
    arm.add(sleeve, hand);
    this.avatar.add(thigh, arm);
    return { thigh, shin, arm };
  }

  private async loadBall(): Promise<void> {
    try {
      const { scene } = await new GLTFLoader().loadAsync(ballUrl);
      if (this.disposed) {
        dispose(scene);
        return;
      }
      dispose(this.ball);
      this.ball.clear();
      this.ball.add(fit(scene, 'y', BALL_RADIUS * 2));
    } catch (error) {
      console.warn('Modelo da bola indisponível:', error);
    }
  }

  private resize(): void {
    const width = Math.max(1, this.stage.clientWidth);
    const height = Math.max(1, this.stage.clientHeight);
    this.camera.aspect = width / height;
    const verticalFov = this.mode === 'walking' ? 38 : 39;
    const horizontalHalfFov = THREE.MathUtils.degToRad(15);
    const verticalHalfFovForWidth = Math.atan(
      Math.tan(horizontalHalfFov) / this.camera.aspect
    );
    this.camera.fov = Math.max(
      verticalFov,
      THREE.MathUtils.radToDeg(2 * verticalHalfFovForWidth)
    );
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(knees: KneeLevels, game: LowerBodyGame, now: number): void {
    for (const side of LEGS) {
      const { thigh, shin, arm } = this.limbs[side];
      const flex = Math.acos(1 - knees[side]);
      thigh.rotation.x = -flex;
      shin.rotation.x = flex * 1.8;
      arm.rotation.x = flex * 0.45;
    }
    const elapsed =
      this.previousTime === null ? 0 : Math.max(0, now - this.previousTime);
    this.previousTime = now;
    if (this.mode === 'walking') {
      this.distance = Math.min(
        game.steps * 0.62,
        this.distance + elapsed * 0.0025
      );
      this.trackMarks.forEach((mark, index) => {
        mark.position.z =
          (index - 3) * TRACK_SPACING - (this.distance % TRACK_SPACING);
      });
    }
    const ball = game.ball;
    this.ball.visible = this.marker.visible = !!ball;
    if (ball) {
      const x = LEG_OFFSET[ball.side];
      this.marker.position.set(x, CONTACT_HEIGHT + BALL_RADIUS, 0.51);
      this.marker.material.color.setHex(
        ball.bounced !== null ? 0x8cf0b5 : ball.ready ? 0xffc956 : 0xa5bbb6
      );
      const contactY = CONTACT_HEIGHT + BALL_RADIUS;
      const height =
        ball.bounced === null
          ? ball.progress < ball.contactProgress
            ? THREE.MathUtils.lerp(
                2.1,
                contactY,
                ball.progress / ball.contactProgress
              )
            : contactY -
              (0.13 * (ball.progress - ball.contactProgress)) /
                (1 - ball.contactProgress)
          : CONTACT_HEIGHT +
            BALL_RADIUS +
            Math.sin((ball.bounced * Math.PI) / 2) * 1.0;
      this.ball.position.set(x, height, 0.46);
      this.ball.rotation.set(now / 650, now / 490, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.observer.disconnect();
    dispose(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
