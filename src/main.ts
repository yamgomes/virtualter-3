import * as THREE from "three";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { obstaculosList } from "./obstaculos";

// === Gameplay States ===
const GameplayState = {
  WaitingToStart: 0,
  Playing: 1,
} as const;

let gameplayState: number = GameplayState.WaitingToStart;

// Mensagem de instrução
const startMsg = document.createElement("div");
startMsg.innerText = "Faça uma T-pose para iniciar";
startMsg.style.position = "absolute";
startMsg.style.top = "50%";
startMsg.style.left = "50%";
startMsg.style.transform = "translate(-50%, -50%)";
startMsg.style.fontSize = "2em";
startMsg.style.color = "white";
startMsg.style.background = "rgba(0,0,0,0.5)";
startMsg.style.padding = "1em 2em";
startMsg.style.borderRadius = "1em";
startMsg.style.zIndex = "200";
startMsg.style.pointerEvents = "none";
document.body.appendChild(startMsg);

// Cabeçalho fixo para informações do jogo
const gameHeader = document.getElementById("game-header");

// Barra de progresso para T-pose
const tPoseBarContainer = document.createElement("div");
// Barra de progresso para T-pose
tPoseBarContainer.style.position = "absolute";
tPoseBarContainer.style.top = "20%";
tPoseBarContainer.style.left = "50%";
tPoseBarContainer.style.transform = "translateX(-50%)";
tPoseBarContainer.style.width = "300px";
tPoseBarContainer.style.height = "30px";
tPoseBarContainer.style.background = "rgba(0,0,0,0.2)";
tPoseBarContainer.style.borderRadius = "15px";
tPoseBarContainer.style.overflow = "hidden";
tPoseBarContainer.style.display = "none";
tPoseBarContainer.style.zIndex = "200";
tPoseBarContainer.style.pointerEvents = "none";
document.body.appendChild(tPoseBarContainer);

const tPoseBar = document.createElement("div");
tPoseBar.style.height = "100%";
tPoseBar.style.width = "0%";
tPoseBar.style.background = "limegreen";
tPoseBar.style.transition = "width 0.1s linear";
tPoseBarContainer.appendChild(tPoseBar);

function updateStateText() {
  if (!gameHeader) return;
  if (gameplayState === GameplayState.WaitingToStart) {
    gameHeader.innerText = "Virtualter 3 - Estado: Esperando iniciar";
    tPoseBarContainer.style.display = "block";
  } else if (gameplayState === GameplayState.Playing) {
    gameHeader.innerText = "Virtualter 3 - Estado: Jogando";
    tPoseBarContainer.style.display = "none";
  } else {
    gameHeader.innerText = "Virtualter 3";
    tPoseBarContainer.style.display = "none";
  }
}
updateStateText();

// === Scene setup ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  innerWidth / innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
// Calcula altura do cabeçalho
const headerHeight = 60;
renderer.setSize(innerWidth, innerHeight - headerHeight);
renderer.domElement.style.position = "absolute";
renderer.domElement.style.top = headerHeight + "px";
renderer.domElement.style.left = "0";
renderer.domElement.style.zIndex = "1";
document.body.appendChild(renderer.domElement);
camera.position.z = 5;

// === Webcam video element ===
const video = document.createElement("video");
video.autoplay = true;
video.playsInline = true;
video.style.display = "none";
document.body.appendChild(video);

navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;
});

// Canvas auxiliar para espelhar o vídeo para detecção
const mirrorCanvas = document.createElement("canvas");
const mirrorCtx = mirrorCanvas.getContext("2d");

// === VideoTexture ===
const videoTexture = new THREE.VideoTexture(video);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.format = THREE.RGBFormat;

let backgroundMesh: THREE.Mesh;

// === Setup background mesh after video loads metadata ===
video.addEventListener("loadedmetadata", () => {
  const videoAspect = video.videoWidth / video.videoHeight;
  const windowAspect = window.innerWidth / window.innerHeight;

  let width = 16;
  let height = width / videoAspect;

  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({ map: videoTexture });
  backgroundMesh = new THREE.Mesh(geometry, material);
  backgroundMesh.position.z = -5;

  // Espelha o vídeo horizontalmente
  backgroundMesh.scale.x = -1;

  // scale to fill screen without squish
  if (videoAspect > windowAspect) {
    backgroundMesh.scale.y = 1;
    backgroundMesh.scale.z = 1;
    backgroundMesh.scale.x *= windowAspect / videoAspect;
  } else {
    backgroundMesh.scale.x *= 1;
    backgroundMesh.scale.y = videoAspect / windowAspect;
    backgroundMesh.scale.z = 1;
  }

  scene.add(backgroundMesh);
});

// === Cube that follows the hand ===
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
scene.add(cube);
cube.visible = false; // Só mostra no estado jogando

// === Pose detection ===
async function setupPose() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    },
    runningMode: "VIDEO",
  });

  async function detectPose() {
    if (video.readyState >= 2) {
      // Espelha o vídeo no canvas auxiliar
      if (video.videoWidth && video.videoHeight && mirrorCtx) {
        mirrorCanvas.width = video.videoWidth;
        mirrorCanvas.height = video.videoHeight;
        mirrorCtx.save();
        mirrorCtx.scale(-1, 1);
        mirrorCtx.drawImage(
          video,
          0,
          0,
          video.videoWidth,
          video.videoHeight,
          -video.videoWidth,
          0,
          video.videoWidth,
          video.videoHeight
        );
        mirrorCtx.restore();
      }
      const result: PoseLandmarkerResult = await poseLandmarker.detectForVideo(
        mirrorCanvas,
        performance.now()
      );
      if (result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];
        // Detecta T-pose: braços estendidos
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];

        // Critério simples: ambos pulsos na mesma altura dos ombros e afastados
        const tPose =
          Math.abs(leftWrist.y - leftShoulder.y) < 0.08 &&
          Math.abs(rightWrist.y - rightShoulder.y) < 0.08 &&
          Math.abs(leftWrist.x - leftShoulder.x) > 0.2 &&
          Math.abs(rightWrist.x - rightShoulder.x) > 0.2;

        // Lógica de T-pose com carregamento
        const TPOSE_REQUIRED_TIME = 5000; // ms
        let tPoseStartTime = (window as any).tPoseStartTime || null;

        if (gameplayState === GameplayState.WaitingToStart) {
          if (tPose) {
            if (!tPoseStartTime) {
              tPoseStartTime = performance.now();
              (window as any).tPoseStartTime = tPoseStartTime;
            }
            const elapsed = performance.now() - tPoseStartTime;
            const percent = Math.min(100, (elapsed / TPOSE_REQUIRED_TIME) * 100);
            tPoseBar.style.width = percent + "%";
            tPoseBar.style.background = percent >= 100 ? "gold" : "limegreen";
            if (elapsed >= TPOSE_REQUIRED_TIME) {
              gameplayState = GameplayState.Playing;
              startMsg.style.display = "none";
              cube.visible = true;
              updateStateText();
              tPoseBar.style.width = "0%";
              (window as any).tPoseStartTime = null;
            }
          } else {
            tPoseBar.style.width = "0%";
            (window as any).tPoseStartTime = null;
          }
        }

        if (gameplayState === GameplayState.Playing) {
          cube.visible = true;
          cube.position.x = (rightWrist.x - 0.5) * 8;
          cube.position.y = -(rightWrist.y - 0.6) * 5;
        } else {
          cube.visible = false;
        }
      }
    }
    requestAnimationFrame(detectPose);
  }

  detectPose();
}

setupPose();

// === Render loop ===
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// === Handle window resize ===
window.addEventListener("resize", () => {
  const headerHeight = 60;
  camera.aspect = innerWidth / (innerHeight - headerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight - headerHeight);
  renderer.domElement.style.top = headerHeight + "px";

  if (backgroundMesh && video.readyState >= 2) {
    const videoAspect = video.videoWidth / video.videoHeight;
    const windowAspect = window.innerWidth / (window.innerHeight - headerHeight);
    if (videoAspect > windowAspect) {
      backgroundMesh.scale.set(windowAspect / videoAspect, 1, 1);
    } else {
      backgroundMesh.scale.set(1, videoAspect / windowAspect, 1);
    }
  }
});
