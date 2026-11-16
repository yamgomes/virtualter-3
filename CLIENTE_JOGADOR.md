# Cliente do jogador — protótipo local

## Executar e experimentar

Use Node.js compatível com o Vite instalado, execute `npm install` e depois `npm run dev`. Abra o endereço exibido no terminal. Na entrada, use um dos códigos fictícios:

- `QWER`: seis batidas de 6 segundos, com combinações de 50% e 80% para os dois braços.
- `ASDF`: quatro batidas de 5 segundos, com combinações alternadas de 40% e 70% para os dois braços.

- `ZXCV`: oito batidas de 6 segundos, com combinações de 40% e 70% para os dois braços.

Os três planos pertencem ao mesmo jogador de demonstração. Confira o plano e permita o acesso à câmera. Após iniciar a calibração, mantenha os dois braços em repouso; quando solicitado, levante ambos até uma altura confortável. Cada posição é registrada automaticamente quando permanece estável. Os alvos de cada braço são relativos à própria amplitude calibrada. Em cada batida, alinhe os cotovelos aos círculos azul e rosa e mantenha os dois braços nos alvos simultaneamente por pelo menos 0,7 segundo antes de as esferas chegarem. O relógio pausa quando a pose não é detectada. A sessão termina após as batidas previstas ou quando o jogador a encerra. O resumo é salvo no `localStorage` deste navegador e o histórico aparece ao voltar ao plano. Apagar os dados do site também apaga o histórico. Não insira informações reais de pacientes: o código não autentica e o armazenamento local não oferece isolamento entre pessoas que compartilham o navegador.

O vídeo é processado no navegador; o modelo e os arquivos WebAssembly do MediaPipe são obtidos pela internet. Portanto, esta versão não é completamente offline. Em dispositivos remotos, a câmera exige HTTPS. Encerrar ou cancelar a preparação libera a câmera. A medida é uma projeção bidimensional, não uma medida clínica de amplitude articular. Não há avaliação clínica.

## Contratos simulados e futuro Firebase

`src/session/types.ts` define os contratos do plano, resultado e repositório; `mockSessionRepository.ts` fornece planos em memória e histórico local. Trocar o repositório exige adaptar o fluxo de acesso e identidade, não apenas substituir a classe: os códigos de demonstração são públicos e não comprovam a identidade do jogador.

Uma arquitetura futura possível:

1. Firebase Authentication estabelece a identidade. Uma função no servidor valida um código de sessão com validade e limite de tentativas, vinculando-o à identidade autorizada; a política de recuperação e de acesso em novos dispositivos deve ser definida antes de usar dados reais. Um código curto sozinho não deve liberar dados de pacientes.
2. Firestore guarda planos versionados e resultados sob caminhos associados ao jogador, por exemplo `patients/{patientId}/plans/{planId}` e `patients/{patientId}/sessions/{sessionId}`. O plano pode conter jogo, membro, níveis normalizados, quantidade e permanência; o resultado registra identificadores do plano e da sessão, duração e quantidade alcançada. Persistir a versão ou cópia dos parâmetros usados garante que mudanças posteriores no plano não alterem o contexto do resultado.
3. Security Rules autorizam operações conforme identidade e vínculo; validação no servidor e regras devem restringir campos e gravações. Operações com SDK administrativo não dependem dessas regras e precisam de autorização própria. Testar regras no emulador antes de qualquer implantação. Referências: [Authentication e Security Rules](https://firebase.google.com/docs/rules/rules-and-auth) e [controle de campos](https://firebase.google.com/docs/firestore/security/rules-fields).
4. O repositório real expõe estados de carregamento, falha e sincronização, com identificadores estáveis para reenvios. A persistência offline na web deve ser uma decisão explícita para dispositivos confiáveis; ela não é habilitada por padrão e o cache pode permanecer entre sessões. Referência: [persistência offline do Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

Esta proposta é um desenho, não uma configuração Firebase implantada. Não há autenticação, nuvem, sincronização, regras nem análise profissional implementadas. O histórico simulado não prova que os controles de acesso do sistema futuro funcionam.

## Relação com a qualificação

A versão corrigida em `qualificacao v2` propõe captura local, filtragem, normalização por amplitude individual, eventos para desacoplar movimento e jogos, métricas, adaptação de dificuldade, MoveNet Lightning e acompanhamento remoto. O repositório encontrado usava MediaPipe e Three.js, tinha um filtro One Euro e quatro modos de jogo, dos quais três são placeholders. Sua reorganização de diretórios havia deixado importações quebradas.

Este protótipo oferece um exercício bilateral de ritmo, filtro, calibração automática, feedback de rastreamento e planos locais simulados. Não implementa MoveNet, API de eventos, jogos de surfe/natação/sentar e levantar, ajuste dinâmico, Firebase ou integração profissional. Os modos anteriores permanecem no código, mas não são oferecidos como jogos concluídos. A implementação não foi validada clinicamente.

## Organização do código ativo

O ponto de entrada `src/main.ts` monta as dependências usadas no protótipo. O fluxo ativo é:

1. `tracking/mediaPipePoseSource.ts` adapta os pontos do MediaPipe para nomes definidos em `tracking/types.ts`. O contrato `PoseSource` permite implementar outro detector sem fazer o jogo depender dos índices do MediaPipe. MoveNet ainda não foi integrado.
2. `tracking/poseFilter.ts` aplica um filtro One Euro independente a cada eixo de cada ponto. Foram mantidos parâmetros iniciais conservadores (1 Hz e beta 0,02), que exigem avaliação com dispositivos e usuários reais; não são parâmetros clinicamente validados. Pontos com baixa visibilidade são descartados e o filtro é reiniciado após perda longa. A opção pelo One Euro visa equilibrar suavização e resposta ao movimento, e não foi comparada experimentalmente com EMA neste projeto.
3. `exercise/shoulderMotion.ts` calcula o ângulo 2D de cada braço em relação ao tronco e normaliza o resultado. `exercise/automaticCalibration.ts` detecta posições estáveis de repouso e alcance de ambos os braços, sem clique de confirmação. `exercise/shoulderGame.ts` avalia os dois alvos ao final de cada batida e retorna eventos de acerto ou erro; a pontuação atual é lúdica (10 pontos por batida acertada), sem significado clínico.
4. `presentation/poseOverlay.ts` desenha um esqueleto simplificado e esferas que avançam até os alvos sobre a câmera espelhada. `presentation/targetPosition.ts` projeta cada alvo na posição do cotovelo correspondente à calibração e ao ângulo solicitado. É uma visualização provisória, não um personagem final.
5. `gameController.ts` coordena as fases, a câmera, a interface e o repositório. Os planos seguem simulados em `session/mockSessionRepository.ts`.

`src/games/`, `baseGameMode.ts`, `gameMode.ts`, `goalManager.ts`, `character.ts` e os gerenciadores antigos em `src/core/` são código anterior e não participam desse fluxo. Os demais jogos continuam como protótipos; os arquivos foram preservados para referência. Evite registrar os modos antigos como se estivessem prontos. Antes de acrescentar jogos, defina um contrato de jogo a partir de casos concretos e migre os protótipos separadamente.

O artigo menciona EMA para suavização e MoveNet Lightning para detecção. O cliente usa One Euro e MediaPipe por enquanto; a escolha, os parâmetros e as diferenças entre o comportamento projetado e o observado precisam ser avaliados. A prévia, a calibração e a estabilidade ainda devem ser testadas com câmera real, em diferentes condições de luz e enquadramento. O modelo de pose é bidimensional na lógica do exercício e não deve ser tratado como medida clínica.

Para rodar os testes isolados sem acrescentar dependências, compile cada arquivo em `tests/` com o `esbuild` instalado pelo Vite e execute o resultado com `node --test`. Os testes de `shoulderGame.test.ts` cobrem calibração, filtro, perda de rastreamento e pontuação; `session.test.ts` cobre o repositório simulado.
