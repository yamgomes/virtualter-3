import { GameController } from "./gameController";

// Aguarda o DOM estar totalmente carregado antes de inicializar o jogo
document.addEventListener('DOMContentLoaded', () => {
  new GameController();
});

// Fallback caso o DOMContentLoaded já tenha disparado
if (document.readyState === 'loading') {
  // DOM ainda está carregando, aguarda o evento
} else {
  // DOM já está pronto
  new GameController();
}
