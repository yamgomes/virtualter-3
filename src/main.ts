import { GameController } from './gameController';
import { MediaPipePoseSource } from './tracking/mediaPipePoseSource';
import { MockSessionRepository } from './session/mockSessionRepository';

const video = document.querySelector<HTMLVideoElement>('#camera');
if (!video) throw new Error('Elemento de vídeo não encontrado');
new GameController(new MediaPipePoseSource(video), new MockSessionRepository());
