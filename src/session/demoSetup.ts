import { GAME_DEFINITIONS, defaultTherapy, intensityPreset, validTherapy } from '@homephysio/contracts';
import type { GameId, TherapyField } from '@homephysio/contracts';
import { therapyPlan } from './therapyPlan';
import type { SessionPlan } from './types';

/** Usa os mesmos parâmetros da prescrição para preparar uma sessão local. */
export class DemoSetup {
  private therapy = defaultTherapy('goalkeeper');
  private container: HTMLElement;
  constructor(container: HTMLElement, signal: AbortSignal, start: (plan: SessionPlan) => void) {
    this.container = container;
    this.render();
    container.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.name === 'demo-game') {
        this.therapy = defaultTherapy(input.value as GameId);
        this.render();
      } else if (input.name === 'intensity' && input.value !== 'custom') {
        Object.assign(this.therapy, intensityPreset(input.value as 'low' | 'moderate' | 'high', this.therapy.gameId));
        this.render();
      }
    }, { signal });
    container.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = container.querySelector('form')!;
      const data = new FormData(form);
      for (const field of GAME_DEFINITIONS[this.therapy.gameId].fields) {
        const raw = data.get(field.key);
        Object.assign(this.therapy, { [field.key]: field.kind === 'integer' || field.kind === 'decimal' ? Number(raw) : String(raw).trim() });
      }
      const error = container.querySelector('[role="alert"]')!;
      if (!validTherapy(this.therapy)) {
        error.textContent = 'Confira os parâmetros. A permanência não pode superar o prazo por alvo.';
        return;
      }
      error.textContent = '';
      const plan = therapyPlan('jogador-demo', 1, this.therapy);
      start({ ...plan, id: 'demonstracao-local', displayName: 'Jogador demonstração' });
    }, { signal });
  }

  private render(): void {
    const games = Object.entries(GAME_DEFINITIONS).map(([id, definition]) => `<option value="${id}" ${id === this.therapy.gameId ? 'selected' : ''}>${definition.label}</option>`).join('');
    const definition = GAME_DEFINITIONS[this.therapy.gameId];
    this.container.innerHTML = `<form class="demo-setup"><h2>Prepare sua demonstração</h2>
      <label for="demo-game">Jogo</label><select id="demo-game" name="demo-game">${games}</select>
      <p>${definition.help ?? 'Ajuste os parâmetros e respeite seu alcance confortável.'}</p>
      <div class="demo-fields">${definition.fields.map(field => this.field(field)).join('')}</div>
      <p role="alert"></p><button type="submit">Usar esta configuração <span>→</span></button>
      <p class="fine">Os resultados desta demonstração ficam neste dispositivo.</p></form>`;
  }

  private field(field: TherapyField): string {
    const value = this.therapy[field.key];
    const id = `demo-${field.key}`;
    const label = `<label for="${id}">${field.label}</label>`;
    if (field.kind === 'select') return `<div>${label}<select id="${id}" name="${field.key}">${field.options.map(option => `<option value="${option.value}" ${option.value === value ? 'selected' : ''}>${option.label}</option>`).join('')}</select>${field.help ? `<small>${field.help}</small>` : ''}</div>`;
    if (field.kind === 'list') return `<div>${label}<input id="${id}" name="${field.key}" value="${value}" maxlength="${field.maxLength}" required><small>${field.help ?? ''}</small></div>`;
    return `<div>${label}<input id="${id}" name="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.decimals ? 10 ** -field.decimals : 1}" value="${value}" required></div>`;
  }
}
