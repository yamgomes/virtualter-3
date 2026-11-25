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

Cada jogo declara sua posição esperada em `GameActivity.posture`, com modo `front`, `front-palms-up` ou `side`: o Semáforo exige frente e o surfe exige lado. A tela mostra essa posição e permite experimentar a tolerância de 0 a 100%; a posição não é escolhida pelo jogador. Para compatibilidade com planos existentes, a tolerância pode vir de `config.posture`, mas o modo do plano não substitui o definido pelo jogo. A verificação usa a razão entre a largura aparente dos ombros e o comprimento médio do tronco: frente exige razão ≥ `0,6 × (1 − tolerância)` e lado exige razão ≤ `0,45 + 0,5 × tolerância`. Essas constantes são hipóteses experimentais, não ângulos em graus nem parâmetros validados; tolerâncias maiores tornam a classificação menos estrita. A confirmação de violação exige 500 ms consecutivos. Quando pontos não estão visíveis, a posição é informada como desconhecida; em vista lateral isso pode acontecer por oclusão. O modo palmas para cima verifica apenas a frente e informa que não é possível confirmar as palmas com o detector de pose atual. Uma violação confirmada pausa a sessão, interrompendo tempo ativo e pontuação. Após três segundos contínuos de alinhamento corporal, a contagem de 3, 2, 1 começa automaticamente. Se a posição for perdida, a espera recomeça. Durante a calibração, uma violação confirmada reinicia a calibração. Jogos sem posição obrigatória omitem `posture` e não são monitorados. No modo com palmas, a retomada considera apenas o alinhamento corporal, pois as palmas não são verificadas.

## Fluxo e responsabilidades

```text
Câmera → PoseSource → PoseBuffer / PoseFilter
                           ↓
                    GameActivity
                    ├─ sensor e calibração do exercício
                    ├─ regras com entrada na unidade do jogo
                    └─ cena e interface próprias
                           ↓
                   resultado da sessão → ResultOutbox → SessionRepository
```

`GameController` coordena câmera, fases da sessão, pausa, encerramento e repositório. Não importa jogos concretos nem conhece articulações. `main.ts` injeta a fábrica de `games/registry.ts`, o detector e o repositório.

`GameActivity` é o coordenador privado de cada jogo: recebe frames, compõe sensores e calibração e encaminha os controles na unidade usada pelas regras. Seu contrato expõe instruções, descrição do plano, calibração, início, atualização, renderização, resultado e descarte.

No Semáforo, `ShoulderInput` entrega os ângulos projetados pela câmera em graus. As regras comparam essa medida com os alvos em graus, e a cena Three.js usa os mesmos valores para desenhar o personagem e os círculos. A atividade acrescenta os dados da calibração ao resultado para o histórico. O surfe usa `SurfGame` e uma cena Canvas 2D. Ambos reutilizam `TargetChallenge`, a mecânica de manter um alvo por um período.

O detector atual é MediaPipe. Nomes de pontos e o contrato `PoseSource` isolam o restante do cliente dos índices e tipos do SDK. Os arquivos WASM são empacotados pelo Vite a partir da mesma versão instalada do SDK; o modelo ainda é carregado de um endereço externo. O cliente não é inteiramente offline.

## Tempo, pausa e recursos

A captura e a renderização possuem ciclos separados. As regras só recebem amostras novas; renderizar novamente não conta como movimento. `PoseBuffer` rejeita timestamps repetidos, futuros e antigos. Uma leitura expira depois de 500 ms. Perder os pontos necessários pausa o prazo do desafio e reinicia a permanência no alvo.

Pausar manualmente ou ocultar a aba interrompe a atividade, e a retomada exige ação explícita. A calibração interrompida ao ocultar a aba recomeça pela preparação. Se a câmera desconectar ou a detecção falhar durante o jogo, a atividade permanece pausada para reconexão ou encerramento. Ao terminar, os recursos da cena e a câmera são liberados; `dispose()` também remove eventos e detector.

`SessionClock` contabiliza tempo total, ativo e pausado. Intervalos longos de suspensão não entram como atividade. Tempos por tentativa são calculados pelas regras usando as amostras de movimento; podem diferir ligeiramente do relógio geral, que acompanha também os frames da interface.

Separar os ciclos não retira a inferência síncrona do MediaPipe da thread principal. Ainda é necessário medir desempenho com câmera e dispositivos reais antes de decidir sobre workers, frequência de inferência e variantes do modelo.

## Planos, resultados e Firebase

O painel do fisioterapeuta será desenvolvido no projeto separado `C:/Repo/homephysio-doc`. Este repositório mantém o cliente do jogador. A comunicação entre os projetos deverá ocorrer por contratos versionados e pelo backend Firebase; o painel não deverá importar componentes internos das cenas dos jogos.

`SessionPlan` é uma união discriminada por `gameId`. No Semáforo, cada braço tem seu próprio ângulo de repouso. A calibração usa a menor amplitude medida para definir o ângulo máximo dos alvos de cada lado. A cada tentativa, o jogo sorteia um ângulo nesses limites. A tolerância em porcentagem do plano é aplicada sobre a amplitude calibrada para determinar a margem em graus. Planos antigos com alvos fixos entre `0` e `1` são convertidos em graus ao iniciar. No Surfe, o plano define os alvos de inclinação e o lado observado. Os dois jogos recebem prazo, permanência e tolerância. `version` identifica a versão do plano. `isSessionPlan` valida os dados na entrada; valores inválidos impedem iniciar a atividade.

O resultado v2 inclui ID estável, versão do jogo, cópia do plano, calibração utilizada, acertos, erros, pontos, resumo de cada tentativa concluída, tempo ativo/pausado/total e motivo de encerramento (`completed`, `stopped`, `error`). O total de tentativas pode ser menor que o planejado em uma sessão interrompida. A posição atual de uma tentativa incompleta não é persistida. Não são gravados vídeos ou séries contínuas de landmarks. Pontuação é lúdica, sem interpretação clínica.

`ResultOutbox` tenta enviar o resultado ao fim da sessão. Se o envio falhar ou a página for fechada antes da confirmação, guarda o resultado pendente com o mesmo ID. O reenvio pode ocorrer pelo botão, no retorno da conexão ou ao carregar o plano. Após a confirmação, a fila remove o resultado do armazenamento. Se o navegador bloquear a gravação, o resultado fica na memória da aba enquanto ela estiver aberta. A sincronização é serializada e seleciona apenas o jogador do plano atual.

No Semáforo, no Goleiro e na elevação convencional, a entrada de ombros conta elevações de cada braço ao atingir 90% da amplitude individual medida. Depois de cada elevação, o braço precisa descer a 70% ou menos para habilitar outra contagem. A calibração inicial, a pausa e a perda de rastreamento não contam como repetições. A atividade devolve essa medida no resultado, separada do placar.

O adaptador Firebase envia o placar, os tempos agregados e as medidas de movimento disponíveis pelo ID da sessão. O terapeuta responsável vê esses resultados no histórico do paciente. O reenvio depende do código e da revisão da terapia permanecerem ativos. A demonstração exibe o resultado somente na tela de encerramento.

## Acrescentar um jogo

1. Em `packages/contracts/games/`, defina o ID, os campos da prescrição, os valores iniciais, a postura e as métricas. Importe a definição na lista de `packages/contracts/game-definitions.ts`. O formulário profissional e a demonstração leem esse catálogo.
2. Em `src/games/<jogo>/`, declare o plano com `defineGamePlan`. Implemente a conversão da prescrição e, quando necessário, a validação da configuração e da calibração, a contagem esperada de tentativas e os textos do resumo local. Registre o plano em `src/games/planRegistry.ts`. Esse módulo roda também nos testes e deve funcionar sem importar cenas ou CSS.
3. Implemente o `GameActivity` e adicione sua fábrica a `src/games/registry.ts`. O jogo recebe poses e produz um resultado. Se quiser usar o som de acerto do jogador, devolva o total de acertos em `update()`. `result()` é chamado ao encerrar a sessão. O jogo pode ser escolhido pela demonstração, que dispensa códigos de teste.
4. Rode `npm run rules:generate` e `npm test`. A lista aceita pelo Firestore é gerada a partir do catálogo. A definição de um jogo pode escolher um perfil existente de publicação em `report`. Sem perfil, o resultado aparece apenas na tela de encerramento. A implantação das regras também regenera a lista.

Para um jogo que usa os campos e tipos de resultado existentes, os únicos pontos de registro são as três listas. O pacote compartilhado mantém os formatos de prescrição e de resultados disponíveis nos dois clientes. Um novo campo de prescrição ou tipo de métrica persistida exige estender esse contrato e suas regras de validação.

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

Na tela inicial, é possível importar o JSON exportado pelo painel profissional de demonstração. O cliente valida o conteúdo antes de preparar a sessão. O arquivo importado é processado localmente. A importação aceita arquivos de até 1 MB.
