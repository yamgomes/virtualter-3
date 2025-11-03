import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Character } from "./character";
import { GoalManager } from "./goalManager";
import { GAME_CONFIG } from "./constants";

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private character: Character;
  private goalManager: GoalManager;
  private backgroundMesh?: THREE.Mesh;
  private sky!: Sky;
  private sun!: THREE.Vector3;

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
    this.createSkybox();
    this.character = new Character(this.scene);
    this.goalManager = new GoalManager(this.scene);
    this.setupEventListeners();
  }

  private setupRenderer(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight - GAME_CONFIG.HEADER_HEIGHT);
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = `${GAME_CONFIG.HEADER_HEIGHT}px`;
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.zIndex = "1";
    document.body.appendChild(this.renderer.domElement);
    this.camera.position.z = 10;
  }

  private createSkybox(): void {
    // Create sky
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    this.scene.add(this.sky);

    // Set sun position
    this.sun = new THREE.Vector3();

    // Configure sky uniforms for blue sky
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 2; // Lower turbidity for clearer blue sky
    uniforms['rayleigh'].value = 1; // Lower rayleigh for more blue
    uniforms['mieCoefficient'].value = 0.002; // Lower mie coefficient
    uniforms['mieDirectionalG'].value = 0.8;

    // Position sun behind the camera (theta = 0 means directly behind)
    const phi = THREE.MathUtils.degToRad(90); // Elevation angle (90 degrees = horizon level)
    const theta = THREE.MathUtils.degToRad(0); // Azimuth angle (0 = behind camera)

    this.sun.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(this.sun);
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
      this.backgroundMesh.visible = true; // Initially visible for waiting state

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

  updatePose(landmarks: any[]): void {
    this.character.updatePose(landmarks);
  }

  showCharacter(position?: THREE.Vector3 | { x: number; y: number; z: number }): void {
    this.character.show(position);
  }

  hideCharacter(): void {
    this.character.hide();
  }

  setCharacterPosition(x: number, y: number, z: number): void {
    this.character.setPosition(x, y, z);
  }

  setCharacterPositionFromVector(position: THREE.Vector3): void {
    this.character.setPositionFromVector(position);
  }

  getCharacterPosition(): THREE.Vector3 {
    return this.character.getPosition();
  }

  // Goal management methods
  startNewGoal(): void {
    this.goalManager.startNewGoal();
  }

  updateGoals(): void {
    this.goalManager.update();
  }

  checkPlayerGoal(landmarks: any[]): boolean {
    return this.goalManager.checkPlayerPose(landmarks);
  }

  completeGoal(): void {
    this.goalManager.completeGoal();
  }

  setGoalCallbacks(onGoalReached?: (goal: any) => void, onGoalCompleted?: () => void): void {
    this.goalManager.setCallbacks(onGoalReached, onGoalCompleted);
  }

  showVideoBackground(): void {
    if (this.backgroundMesh) {
      this.backgroundMesh.visible = true;
    }
  }

  hideVideoBackground(): void {
    if (this.backgroundMesh) {
      this.backgroundMesh.visible = false;
    }
  }

  render(): void {
    this.updateGoals();
    this.renderer.render(this.scene, this.camera);
  }
}