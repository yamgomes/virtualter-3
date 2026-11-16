# Cliente do jogador

## Atividades disponíveis

| Código | Atividade             | Preparação                     |
| ------ | --------------------- | ------------------------------ |
| QWER   | Semáforo              | De frente, ambos os braços     |
| ASDF   | Semáforo · alternadas | De frente, ambos os braços     |
| ZXCV   | Semáforo · sequência  | De frente, ambos os braços     |
| SURF   | Seis ondas            | Lado esquerdo voltado à câmera |
| ONDA   | Seis ondas            | Lado direito voltado à câmera  |

Todos os códigos são públicos e fictícios, associados ao mesmo jogador de demonstração. Eles não autenticam pessoas. Não use dados reais de pacientes neste protótipo. O formulário de configuração na tela do plano é uma simulação local, ainda não é um painel autenticado do fisioterapeuta e não altera os planos no Firebase.

A preparação é definida pelo jogo. Nos ombros, mantenha repouso e depois eleve os dois braços até um alcance confortável. No surfe, mantenha o tronco ereto e depois incline-o para a frente, em vista lateral. Cada posição precisa permanecer estável por 1,8 segundo. A calibração dos ombros exige diferença de pelo menos 15 graus projetados; a do surfe, 10 graus. Esses valores são parâmetros do protótipo, sem validação clínica.

Ao autorizar e preparar a câmera, a calibração começa automaticamente e avança quando cada posição é mantida; não é necessário apertar botões durante essa etapa. O clique para iniciar a câmera continua necessário para consentimento e para habilitar o áudio no navegador.

Os parâmetros da demonstração incluem duração total ativa, meta mínima de acertos, pontos por acerto, tempo por alvo, permanência e tolerância. A partida continua até o tempo total acabar; ultrapassar a meta soma mais pontos. Após um acerto, o jogador precisa sair do alvo atual antes de pontuar novamente no mesmo alvo. Se o prazo de um alvo terminar, conta-se um erro e o jogo passa ao próximo. O tempo pausa durante perda de rastreamento ou pausa manual. O som de acerto depende da autorização de áudio do navegador. O painel do profissional e a persistência desses parâmetros no Firebase ainda precisam ser implementados.

O surfe usa somente ombro e quadril do lado indicado. O sentido do movimento é aprendido durante a calibração; inclinar para a frente move o surfista da esquerda para a direita, independentemente da direção para a qual a pessoa está virada. Voltar ao repouso retorna o personagem à esquerda. Mantenha o mesmo lado e orientação durante a partida. O enquadramento lateral é orientado pela interface, mas não é reconhecido automaticamente. Os braços do surfista usam uma pose visual fixa.

No Semáforo, cada ângulo é calculado entre os segmentos ombro–cotovelo e ombro–quadril do mesmo lado, projetados na imagem da câmera. A referência é o tronco detectado em 2D; giros para fora do plano da câmera, oclusão e flexão do cotovelo limitam a correspondência com a postura tridimensional ou com uma comunicação real de bandeiras.

Cada jogo declara sua posição esperada em `GameActivity.posture`, com modo `front`, `front-palms-up` ou `side`: o Semáforo exige frente e o surfe exige lado. A tela mostra essa posição e permite experimentar a tolerância de 0 a 100%; a posição não é escolhida pelo jogador. Para compatibilidade com planos existentes, a tolerância pode vir de `config.posture`, mas o modo do plano não substitui o definido pelo jogo. A verificação usa a razão entre a largura aparente dos ombros e o comprimento médio do tronco: frente exige razão ≥ `0,6 × (1 − tolerância)` e lado exige razão ≤ `0,45 + 0,5 × tolerância`. Essas constantes são hipóteses experimentais, não ângulos em graus nem parâmetros validados; tolerâncias maiores tornam a classificação menos estrita. A confirmação de violação exige 500 ms consecutivos. Quando pontos não estão visíveis, a posição é informada como desconhecida; em vista lateral isso pode acontecer por oclusão. O modo palmas para cima verifica apenas a frente e informa que não é possível confirmar as palmas com o detector de pose atual. Uma violação confirmada pausa a sessão, interrompendo tempo ativo e pontuação. Após 500 ms de alinhamento corporal, o jogador pode retomar; perda de rastreamento impede a liberação dessa pausa. Durante a calibração, uma violação confirmada reinicia a calibração. Jogos sem posição obrigatória omitem `posture` e não são monitorados. No modo com palmas, a retomada considera apenas o alinhamento corporal, pois as palmas não são verificadas.

## Fluxo e responsabilidades

```text
Câmera → PoseSource → PoseBuffer / PoseFilter
                           ↓
                    GameActivity
                    ├─ sensor e calibração do exercício
                    ├─ regras com entrada normalizada
                    └─ cena e interface próprias
                           ↓
                   resultado da sessão → ResultOutbox → SessionRepository
```

`GameController` coordena câmera, fases da sessão, pausa, encerramento e repositório. Não importa jogos concretos nem conhece articulações. `main.ts` injeta a fábrica de `games/registry.ts`, o detector e o repositório.

`GameActivity` é o coordenador privado de cada jogo: recebe frames, compõe sensores/calibração e encaminha controles normalizados às regras. Seu contrato expõe instruções, descrição do plano, calibração, início, atualização, renderização, resultado e descarte. Não obriga os jogos a compartilhar avatar, cena ou tecnologia gráfica.

O jogo dos ombros mantém `ShoulderGame` como regra pura, `ShoulderSession` como coordenador de interface e `ShoulderScene` como apresentação Three.js. A cena recebe ângulos visuais prontos, sem recalcular calibração. O surfe usa `SurfGame` e uma cena Canvas 2D. Ambos escolhem reutilizar `TargetChallenge`, a mecânica de manter um alvo por um período. Jogos futuros podem implementar regras diferentes sem usar essa classe.

O detector atual é MediaPipe. Nomes de pontos e o contrato `PoseSource` isolam o restante do cliente dos índices e tipos do SDK. Os arquivos WASM são empacotados pelo Vite a partir da mesma versão instalada do SDK; o modelo ainda é carregado de um endereço externo. O cliente não é inteiramente offline.

## Tempo, pausa e recursos

A captura e a renderização possuem ciclos separados. As regras só recebem amostras novas; renderizar novamente não conta como movimento. `PoseBuffer` rejeita timestamps repetidos, futuros e antigos. Uma leitura expira depois de 500 ms. Perder os pontos necessários pausa o prazo do desafio e reinicia a permanência no alvo.

Pausar manualmente ou ocultar a aba interrompe a atividade, e a retomada exige ação explícita. A calibração interrompida ao ocultar a aba recomeça pela preparação. Se a câmera desconectar ou a detecção falhar durante o jogo, a atividade permanece pausada para reconexão ou encerramento. Ao terminar, os recursos da cena e a câmera são liberados; `dispose()` também remove eventos e detector.

`SessionClock` contabiliza tempo total, ativo e pausado. Intervalos longos de suspensão não entram como atividade. Tempos por tentativa são calculados pelas regras usando as amostras de movimento; podem diferir ligeiramente do relógio geral, que acompanha também os frames da interface.

Separar os ciclos não retira a inferência síncrona do MediaPipe da thread principal. Ainda é necessário medir desempenho com câmera e dispositivos reais antes de decidir sobre workers, frequência de inferência e variantes do modelo.

## Planos, resultados e Firebase futuro

O painel do fisioterapeuta será desenvolvido no projeto separado `C:/Repo/homephysio-doc`. Este repositório mantém o cliente do jogador. A comunicação entre os projetos deverá ocorrer por contratos versionados e pelo backend Firebase; o painel não deverá importar componentes internos das cenas dos jogos.

`SessionPlan` é uma união discriminada por `gameId`. Cada jogo tem sua configuração tipada: alvos bilaterais ou valores de inclinação, prazo, permanência, tolerância e, no surfe, lado observado. `version` identifica a versão do plano. `isSessionPlan` valida os dados na entrada; valores inválidos impedem iniciar a atividade.

O resultado v2 inclui ID estável, versão do jogo, cópia do plano, calibração utilizada, acertos, erros, pontos, resumo de cada tentativa concluída, tempo ativo/pausado/total e motivo de encerramento (`completed`, `stopped`, `error`). O total de tentativas pode ser menor que o planejado em uma sessão interrompida. A posição atual de uma tentativa incompleta não é persistida. Não são gravados vídeos ou séries contínuas de landmarks. Pontuação é lúdica, sem interpretação clínica.

`ResultOutbox` coloca o resultado numa fila local antes do envio. Em caso de falha, mantém o mesmo ID para reenvio pelo botão ou quando a conexão retorna. A fila sobrevive à recarga quando o armazenamento local está disponível. Se houver falta de espaço ou bloqueio, o resultado fica apenas na memória da aba, com aviso explícito. Conteúdo corrompido não é sobrescrito. A sincronização é serializada e seleciona apenas o jogador do plano atual.

`SessionRepository.saveResult` deve ser idempotente por ID. O adaptador Firebase futuro implementará essa fronteira; seus SDKs não deverão entrar nas regras ou cenas. A identidade autenticada deverá vir da camada de acesso e ser verificada no backend, com autorização dos planos/resultados. Os códigos de demonstração não substituem esse trabalho. Nenhum Firebase, autenticação, Security Rules ou acompanhamento profissional foi implantado nesta mudança.

O repositório de demonstração faz upsert no `localStorage`. Ele preserva o histórico v1 sob sua chave original, mas exibe somente resultados v2, pois os registros antigos não contêm calibração e cópia do plano. Dados locais continuam acessíveis a quem compartilha este navegador; a persistência local deverá ser revista para o produto autenticado.

## Acrescentar um jogo

1. Defina a variante de configuração em `session/types.ts` e sua validação.
2. Crie ou reutilize sensores e calibração em `exercise/`.
3. Implemente regras que recebam controles normalizados e possam ser testadas sem navegador.
4. Crie sua apresentação e um `GameActivity` que componha esses elementos.
5. Registre a fábrica em `games/registry.ts` e um plano no mock.
6. Teste preparação, perda de rastreamento, pausa, conclusão, interrupção e descarte.

A inclusão de um jogo não exige condições específicas em `GameController`.

## Verificação

```sh
npm run typecheck
npm test
npm run build
```

`npm test` compila testes com o esbuild fornecido pelo Vite e executa o runner nativo do Node. Inclui poses sintéticas, calibração, pontuação, rejeição de frames antigos, validação de dados, temporização, fila de reenvio e corridas assíncronas no controlador.

Para testar no navegador, disponibilize Playwright e um navegador compatível, inicie Vite na porta 5180 e execute `npm run test:browser`. As variáveis opcionais `PLAYWRIGHT_MODULE`, `BROWSER_PATH` e `TEST_ORIGIN` permitem usar instalações existentes. O script substitui somente a composição inicial por uma câmera e poses sintéticas; usa os módulos reais de calibração, regras, cenas e persistência. Verifica ombros em desktop e surfe em viewport de celular. Capturas ficam em `output/qa/`, fora do Git. Não há um modo de simulação acessível no aplicativo de produção.

Os testes simulados não validam a qualidade da pose detectada, a orientação lateral, iluminação, oclusões, latência em celulares ou precisão de medidas. Esses pontos precisam de experimentação com câmera real. A implementação ainda difere da qualificação ao usar MediaPipe e One Euro; não inclui DDA ou avaliação clínica. O contrato atual usa estado contínuo e eventos retornados pelas regras, sem barramento Observer global.

## Código histórico

Os antigos `GameMode`, `BaseGameMode`, gerenciadores de `core/` e placeholders foram preservados em `legacy/`, fora do build ativo. A documentação histórica está em `legacy/MODULAR_SYSTEM.md`.

# Importação local de atividade

Na tela inicial, é possível importar o JSON exportado pelo painel profissional de demonstração. O cliente valida o conteúdo antes de preparar a sessão. O arquivo e o histórico são locais, sem autenticação ou sincronização com o painel; não use dados reais de pacientes. A importação aceita arquivos de até 1 MB.

