# Sistema Modular de Jogos - Nome Temporário

## Visão Geral

O Nome Temporário agora possui um sistema modular que permite a criação e seleção de diferentes tipos de jogos de exercícios. O sistema foi projetado para ser extensível, permitindo a adição fácil de novos modos de jogo.

## Estrutura do Sistema

### Arquitetura Modular

1. **GameMode Interface** (`src/gameMode.ts`)
   - Define a estrutura básica que todos os jogos devem implementar
   - Métodos para criar objetivos, verificar conclusão, processar poses e visualizar

2. **BaseGameMode** (`src/baseGameMode.ts`)
   - Classe abstrata com funcionalidades comuns
   - Métodos utilitários para cálculos de ângulos, tolerâncias e objetos 3D

3. **GameModeManager** (`src/gameModeManager.ts`)
   - Gerenciador singleton para registrar e instanciar modos de jogo
   - Sistema de metadados para categorização e filtragem

4. **GameSelectionUI** (`src/gameSelectionUI.ts`)
   - Interface de usuário para seleção de jogos
   - Exibe cards com informações dos jogos disponíveis

## Jogos Implementados

### 1. Ângulos dos Braços (Funcional)
- **Arquivo**: `src/gameModes/armAngleGameMode.ts`
- **Descrição**: Posicione seus braços nos ângulos indicados pelas esferas coloridas
- **Categoria**: Fitness
- **Dificuldade**: Fácil
- **Status**: ✅ Totalmente implementado

### 2. Simulador de Surfe (Placeholder)
- **Arquivo**: `src/gameModes/surfingGameMode.ts`
- **Descrição**: Simule movimentos de surfe para manter o equilíbrio
- **Categoria**: Entretenimento
- **Dificuldade**: Médio
- **Status**: 🚧 Estrutura criada, lógica pendente

### 3. Sentar e Levantar (Placeholder)
- **Arquivo**: `src/gameModes/sitStandGameMode.ts`
- **Descrição**: Realize exercícios de sentar e levantar
- **Categoria**: Reabilitação
- **Dificuldade**: Fácil
- **Status**: 🚧 Estrutura criada, lógica pendente

### 4. Simulador de Natação (Placeholder)
- **Arquivo**: `src/gameModes/swimmingGameMode.ts`
- **Descrição**: Simule diferentes estilos de natação
- **Categoria**: Fitness
- **Dificuldade**: Difícil
- **Status**: 🚧 Estrutura criada, lógica pendente

## Como Criar um Novo Jogo

### 1. Criar a Classe do Jogo

```typescript
import { BaseGameMode } from "../baseGameMode";
import type { GameModeConfig } from "../gameMode";

export class MeuNovoJogo extends BaseGameMode {
  readonly name = "meu-jogo";
  readonly displayName = "Meu Novo Jogo";
  readonly description = "Descrição do meu jogo";

  public createGoal(): MeuObjetivo {
    // Implementar criação de objetivos
  }

  public checkGoalAchieved(landmarks: any[], goal: MeuObjetivo): boolean {
    // Implementar verificação de conclusão
  }

  public updateGoalVisualization(goal: MeuObjetivo): void {
    // Implementar visualização 3D
  }

  public processPose(landmarks: any[]): MeusDadosPose {
    // Implementar processamento de pose
  }

  public getGameConfig(): GameModeConfig {
    // Retornar configurações específicas
  }
}
```

### 2. Registrar o Jogo

No arquivo `src/gameModeManager.ts`, adicione o registro:

```typescript
this.registerMode({
  name: "meu-jogo",
  displayName: "Meu Novo Jogo",
  description: "Descrição do meu jogo",
  category: "fitness", // ou "rehabilitation" ou "entertainment"
  difficulty: "easy",   // ou "medium" ou "hard"
  bodyParts: ["braços", "pernas"],
  constructor: MeuNovoJogo
});
```

## Fluxo de Funcionamento

1. **Inicialização**: O sistema carrega todos os jogos registrados
2. **Seleção**: O usuário escolhe um jogo na tela de seleção
3. **Inicialização do Jogo**: O modo selecionado é instanciado e inicializado
4. **Gameplay**: O sistema usa o modo atual para:
   - Criar objetivos específicos
   - Verificar se foram atingidos
   - Atualizar visualizações
   - Processar poses detectadas

## Configuração Visual

Cada jogo pode definir suas próprias cores e tamanhos através do `GameModeConfig`:

```typescript
visualConfig: {
  colors: {
    primary: 0xff4757,   // Cor principal
    secondary: 0x3742fa, // Cor secundária
    success: 0x2ed573,   // Cor de sucesso
    error: 0xff4757      // Cor de erro
  },
  sizes: {
    goalSize: 0.3,       // Tamanho dos objetivos
    indicatorSize: 0.15  // Tamanho dos indicadores
  }
}
```

## Estrutura de Arquivos

```
src/
├── gameMode.ts              # Interface principal
├── baseGameMode.ts          # Classe base abstrata
├── gameModeManager.ts       # Gerenciador de modos
├── gameSelectionUI.ts       # Interface de seleção
├── gameController.ts        # Controlador principal (atualizado)
└── gameModes/
    ├── armAngleGameMode.ts  # Jogo dos ângulos (implementado)
    ├── surfingGameMode.ts   # Surfe (placeholder)
    ├── sitStandGameMode.ts  # Sentar/levantar (placeholder)
    └── swimmingGameMode.ts  # Natação (placeholder)
```

## Próximos Passos

Para completar a implementação dos jogos placeholder:

1. **Implementar lógica de detecção de pose específica** para cada jogo
2. **Criar visualizações 3D** adequadas para cada tipo de exercício
3. **Definir objetivos e métricas** específicas de cada modalidade
4. **Testar e ajustar tolerâncias** para melhor experiência do usuário
5. **Adicionar feedback visual e sonoro** específico para cada jogo

## Benefícios do Sistema Modular

- ✅ **Extensibilidade**: Fácil adição de novos jogos
- ✅ **Manutenibilidade**: Código organizado e separado por responsabilidades
- ✅ **Reutilização**: Funcionalidades comuns compartilhadas
- ✅ **Flexibilidade**: Cada jogo pode ter suas próprias regras e visualizações
- ✅ **Escalabilidade**: Sistema suporta crescimento sem refatoração major