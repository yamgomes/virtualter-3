// Gerenciamento de elementos UI
import { UI_STYLES } from "./constants";

export class UIManager {
  public startMsg!: HTMLDivElement;
  public tPoseBarContainer!: HTMLDivElement;
  public tPoseBar!: HTMLDivElement;

  constructor() {
    this.createStartMessage();
    this.createTPoseProgressBar();
  }

  private createStartMessage(): void {
    this.startMsg = document.createElement("div");
    this.startMsg.innerText = "Faça uma T-pose para iniciar";

    this.applyStyles(this.startMsg, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "2em",
      color: "white",
      background: "rgba(0,0,0,0.5)",
      padding: "1em 2em",
      borderRadius: "1em",
      zIndex: UI_STYLES.OVERLAY_Z_INDEX,
      pointerEvents: "none"
    });

    document.body.appendChild(this.startMsg);
  }

  private createTPoseProgressBar(): void {
    this.tPoseBarContainer = document.createElement("div");

    this.applyStyles(this.tPoseBarContainer, {
      position: "absolute",
      top: "20%",
      left: "50%",
      transform: "translateX(-50%)",
      width: "300px",
      height: "30px",
      background: "rgba(0,0,0,0.2)",
      borderRadius: "15px",
      overflow: "hidden",
      display: "none",
      zIndex: UI_STYLES.OVERLAY_Z_INDEX,
      pointerEvents: "none"
    });

    this.tPoseBar = document.createElement("div");
    this.applyStyles(this.tPoseBar, {
      height: "100%",
      width: "0%",
      background: "limegreen",
      transition: "width 0.1s linear"
    });

    this.tPoseBarContainer.appendChild(this.tPoseBar);
    document.body.appendChild(this.tPoseBarContainer);
  }

  private applyStyles(element: HTMLElement, styles: Record<string, string>): void {
    Object.assign(element.style, styles);
  }

  showTPoseBar(): void {
    this.tPoseBarContainer.style.display = "block";
  }

  hideTPoseBar(): void {
    this.tPoseBarContainer.style.display = "none";
  }

  hideStartMessage(): void {
    this.startMsg.style.display = "none";
  }

  updateTPoseProgress(percent: number): void {
    this.tPoseBar.style.width = `${percent}%`;
    this.tPoseBar.style.background = percent >= 100 ? "gold" : "limegreen";
  }

  resetTPoseProgress(): void {
    this.tPoseBar.style.width = "0%";
  }
}