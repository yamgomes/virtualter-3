# Virtualter — cliente de exergames

Cliente web em TypeScript para executar atividades com movimentos capturados pela câmera. O jogo Semáforo controla dois braços; o surfe controla a posição de um personagem pela inclinação do tronco em vista lateral. Cada jogo possui preparação, regras e apresentação próprias.

## Executar

```sh
npm install
npm run dev
```

Códigos fictícios: **QWER**, **ASDF** e **ZXCV** para ombros; **SURF** para surfe com o lado esquerdo voltado à câmera; **ONDA** para surfe com o lado direito. Siga o enquadramento exibido antes de calibrar.

Na tela inicial, **Experimentar demonstração** permite escolher um jogo sem código ou vínculo com fisioterapeuta. O resultado aparece ao fim da partida.

```sh
npm run typecheck
npm test
npm run build
```

O cliente envia os resultados das sessões prescritas ao Firebase. O navegador guarda os envios pendentes até a confirmação do servidor. O detector processa o vídeo localmente e baixa o modelo de pose pela internet. As medidas são projeções 2D e o protótipo não foi validado clinicamente.

## Arquitetura ativa

- `src/tracking/`: fonte de pose, filtro e validade temporal das amostras.
- `src/exercise/`: medidas e calibração de movimentos, independentes da apresentação.
- `src/games/`: contrato de atividade, composição dos jogos e apresentações próprias.
- `src/session/`: planos e resultados validados, relógio e fila de reenvio.
- `src/gameController.ts`: ciclo de vida da aplicação, câmera, pausa e persistência.
- `src/main.ts`: composição das dependências.
- `legacy/`: protótipos anteriores, preservados fora do build ativo.

Veja [CLIENTE_JOGADOR.md](CLIENTE_JOGADOR.md) para contratos, extensão do cliente, testes no navegador e limites atuais.
