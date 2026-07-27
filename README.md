# Nome Temporário - Estrutura do Código

## Organização dos Arquivo

### 📁 Estrutura de Arquivos

```
src/
├── main.ts              # Ponto de entrada - apenas inicializa o GameController
├── gameController.ts    # Controlador principal do jogo - coordena todos os módulos
├── gameState.ts         # Gerenciamento de estados do jogo
├── uiManager.ts         # Gerenciamento de elementos de UI (overlays, barras)
├── sceneManager.ts      # Gerenciamento da cena Three.js e renderização
├── poseDetector.ts      # Detecção de poses com MediaPipe
├── videoManager.ts      # Gerenciamento da câmera/vídeo
├── constants.ts         # Constantes centralizadas do jogo
├── obstaculos.ts        # Lista de obstáculos (não modificado)
└── style.css           # Estilos CSS
```

### 🔧 Módulos e Responsabilidades

#### **GameController** (`gameController.ts`)
- **Responsabilidade**: Orquestração principal do jogo
- **Funções**: Coordena todos os outros módulos, gerencia o loop do jogo, lida com a lógica de transição de estados

#### **GameStateManager** (`gameState.ts`)
- **Responsabilidade**: Gerenciamento de estados do jogo
- **Funções**: Controla estados (WaitingToStart, Playing), atualiza cabeçalho com informações

#### **UIManager** (`uiManager.ts`)
- **Responsabilidade**: Elementos de interface do usuário
- **Funções**: Cria e gerencia overlays (mensagem de início, barra de progresso T-pose)

#### **SceneManager** (`sceneManager.ts`)
- **Responsabilidade**: Cena 3D e renderização
- **Funções**: Configura Three.js, gerencia câmera/renderer, background de vídeo, cubo que segue a mão

#### **PoseDetector** (`poseDetector.ts`)
- **Responsabilidade**: Detecção de poses corporais
- **Funções**: Inicializa MediaPipe, detecta T-pose, calcula posição da mão

#### **VideoManager** (`videoManager.ts`)
- **Responsabilidade**: Acesso à câmera
- **Funções**: Configura elemento de vídeo, solicita permissão da câmera

#### **Constants** (`constants.ts`)
- **Responsabilidade**: Configurações centralizadas
- **Funções**: Define constantes do jogo (tempos, thresholds, escalas)

### 🎯 Benefícios da Nova Estrutura

1. **Separação de Responsabilidades**: Cada classe tem uma função específica
2. **Redução de Repetição**: Código duplicado foi eliminado
3. **Facilidade de Manutenção**: Mudanças em uma área não afetam outras
4. **Testabilidade**: Cada módulo pode ser testado independentemente
5. **Escalabilidade**: Fácil adicionar novas funcionalidades
6. **Configuração Centralizada**: Constantes em um só lugar

### 🚀 Como Usar

O jogo é iniciado simplesmente importando e instanciando o `GameController`:

```typescript
import { GameController } from "./gameController";

// Inicializa o jogo
new GameController();
```

### 🛠️ Modificações Futuras

Para adicionar novas funcionalidades:

1. **Novos Estados**: Edite `gameState.ts`
2. **Novos Elementos UI**: Adicione métodos em `uiManager.ts`
3. **Novos Objetos 3D**: Modifique `sceneManager.ts`
4. **Novas Detecções**: Estenda `poseDetector.ts`
5. **Novas Configurações**: Adicione em `constants.ts`