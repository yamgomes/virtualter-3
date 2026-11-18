import { GameController } from './gameController';
import { createActivity } from './games/registry';
import { FirebaseSessionRepository } from './session/firebaseSessionRepository';
import { MediaPipePoseSource } from './tracking/mediaPipePoseSource';

const video = document.querySelector<HTMLVideoElement>('#camera');
if (!video) throw new Error('Elemento de vídeo não encontrado');
const controller = new GameController(
  new MediaPipePoseSource(video),
  new FirebaseSessionRepository(),
  createActivity
);
if (import.meta.hot) import.meta.hot.dispose(() => controller.dispose());
