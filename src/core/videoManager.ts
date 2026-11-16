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
    this.video.muted = true; // Add muted to ensure autoplay works
    this.video.style.display = "none";
    document.body.appendChild(this.video);
  }

  private async requestCamera(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.video.srcObject = stream;

      // Ensure video starts playing
      this.video.addEventListener('loadedmetadata', () => {
        this.video.play().catch(err => console.error('Video play failed:', err));
      });
    } catch (error) {
      console.error("Erro ao acessar a câmera:", error);
    }
  }
}