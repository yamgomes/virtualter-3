export interface SurfVisualState {
  position: number;
  target: number;
  tolerance: number;
  tracking: boolean;
}
/** Cena 2D própria do surfe: só a posição do personagem responde ao movimento. */
export class SurfScene {
  private canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D;
  private container: HTMLElement;
  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas.className = 'surf-canvas';
    this.canvas.setAttribute(
      'aria-label',
      'Surfista sobre a onda; leve-o até a faixa dourada.'
    );
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponível');
    this.context = context;
    container.append(this.canvas);
    container.classList.add('surf-stage');
  }
  render(state: SurfVisualState, now: number): void {
    const w = Math.max(1, this.container.clientWidth),
      h = Math.max(1, this.container.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (
      this.canvas.width !== Math.round(w * ratio) ||
      this.canvas.height !== Math.round(h * ratio)
    ) {
      this.canvas.width = Math.round(w * ratio);
      this.canvas.height = Math.round(h * ratio);
    }
    const c = this.context;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#143954');
    sky.addColorStop(1, '#2e9dba');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffe1a0';
    c.beginPath();
    c.arc(w * 0.83, h * 0.19, h * 0.065, 0, Math.PI * 2);
    c.fill();
    const track = (v: number) => w * (0.15 + v * 0.7);
    c.fillStyle = '#ffe1a045';
    c.fillRect(
      track(state.target - state.tolerance),
      h * 0.32,
      w * 0.7 * state.tolerance * 2,
      h * 0.44
    );
    for (let layer = 0; layer < 3; layer++) {
      c.fillStyle = ['#126d94', '#07587f', '#063e64'][layer];
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8)
        c.lineTo(
          x,
          h * (0.64 + layer * 0.11) +
            Math.sin(x / 65 - now / (900 + layer * 200)) * h * 0.025
        );
      c.lineTo(w, h);
      c.closePath();
      c.fill();
    }
    const x = track(state.position),
      y = h * 0.61 + Math.sin(now / 900) * h * 0.012;
    const s = Math.min(w, h) / 400;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.globalAlpha = state.tracking ? 1 : 0.5;
    c.fillStyle = '#f6ba66';
    c.beginPath();
    c.ellipse(0, 0, 49, 8, -0.06, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fff5e5';
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-20, -7);
    c.lineTo(-9, -34);
    c.lineTo(7, -50);
    c.lineTo(17, -10);
    c.stroke();
    c.strokeStyle = '#8df0d1';
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(7, -50);
    c.lineTo(-3, -80);
    c.stroke();
    c.strokeStyle = '#fff5e5';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(-28, -57);
    c.lineTo(-3, -74);
    c.lineTo(30, -62);
    c.stroke();
    c.fillStyle = '#fff5e5';
    c.beginPath();
    c.arc(-5, -96, 12, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.fillStyle = '#eefaff';
    c.font = '600 14px system-ui';
    c.textAlign = 'center';
    c.fillText('REPOUSO', track(0), h * 0.91);
    c.fillText('INCLINAÇÃO', track(1), h * 0.91);
  }
  dispose(): void {
    this.canvas.remove();
    this.container.classList.remove('surf-stage');
  }
}
