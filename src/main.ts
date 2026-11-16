import { GameController } from './gameController';
import { MediaPipePoseSource } from './tracking/mediaPipePoseSource';
import { FirebaseSessionRepository } from './session/firebaseSessionRepository';
import { createActivity } from './games/registry';

const video = document.querySelector<HTMLVideoElement>('#camera');
if (!video) throw new Error('Elemento de vídeo não encontrado');
const controller = new GameController(
  new MediaPipePoseSource(video),
  new FirebaseSessionRepository(),
  createActivity
);
if (import.meta.hot) import.meta.hot.dispose(() => controller.dispose());

