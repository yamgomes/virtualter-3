import * as THREE from "three";
import { GAME_CONFIG } from "./constants";

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public cube!: THREE.Mesh;
  private backgroundMesh?: THREE.Mesh;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / (window.innerHeight - GAME_CONFIG.HEADER_HEIGHT),
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });

    this.setupRenderer();
    this.createCube();
    this.setupEventListeners();
  }

  private setupRenderer(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight - GAME_CONFIG.HEADER_HEIGHT);
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = `${GAME_CONFIG.HEADER_HEIGHT}px`;
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.zIndex = "1";
    document.body.appendChild(this.renderer.domElement);
    this.camera.position.z = 5;
  }

  private createCube(): void {
    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    this.scene.add(this.cube);
    this.cube.visible = false;
  }

  private setupEventListeners(): void {
    window.addEventListener("resize", () => this.handleResize());
  }

  private handleResize(): void {
    this.camera.aspect = window.innerWidth / (window.innerHeight - GAME_CONFIG.HEADER_HEIGHT);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight - GAME_CONFIG.HEADER_HEIGHT);
    this.renderer.domElement.style.top = `${GAME_CONFIG.HEADER_HEIGHT}px`;

    if (this.backgroundMesh) {
      this.updateBackgroundScale();
    }
  }

  setupVideoBackground(video: HTMLVideoElement): void {
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBFormat;

    video.addEventListener("loadedmetadata", () => {
      const geometry = new THREE.PlaneGeometry(16, 16 / (video.videoWidth / video.videoHeight));
      const material = new THREE.MeshBasicMaterial({ map: videoTexture });
      this.backgroundMesh = new THREE.Mesh(geometry, material);
      this.backgroundMesh.position.z = -5;
      this.backgroundMesh.scale.x = -1; // Espelha horizontalmente

      this.updateBackgroundScale();
      this.scene.add(this.backgroundMesh);
    });
  }

  private updateBackgroundScale(): void {
    if (!this.backgroundMesh) return;

    const video = (this.backgroundMesh.material as THREE.MeshBasicMaterial).map?.image;
    if (!video || !video.videoWidth) return;

    const videoAspect = video.videoWidth / video.videoHeight;
    const windowAspect = window.innerWidth / (window.innerHeight - GAME_CONFIG.HEADER_HEIGHT);

    if (videoAspect > windowAspect) {
      this.backgroundMesh.scale.set(-windowAspect / videoAspect, 1, 1);
    } else {
      this.backgroundMesh.scale.set(-1, videoAspect / windowAspect, 1);
    }
  }

  updateCubePosition(x: number, y: number): void {
    this.cube.position.x = x;
    this.cube.position.y = y;
  }

  showCube(): void {
    this.cube.visible = true;
  }

  hideCube(): void {
    this.cube.visible = false;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}