export class VideoManager {
  public video: HTMLVideoElement;

  constructor() {
    this.video = document.createElement("video");
    this.setupVideo();
    this.requestCamera();
  }

  private setupVideo(): void {
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.style.display = "none";
    document.body.appendChild(this.video);
  }

  private async requestCamera(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.video.srcObject = stream;
    } catch (error) {
      console.error("Erro ao acessar a câmera:", error);
    }
  }
}