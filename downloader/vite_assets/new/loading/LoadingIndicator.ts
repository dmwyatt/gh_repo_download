// LoadingIndicator.ts
export class LoadingIndicator {
  private element: HTMLElement;
  private progressContainer: HTMLElement;
  private progressBar: HTMLElement;
  private messageElement: HTMLElement;

  constructor(id: string = "loading-indicator") {
    this.element = document.getElementById(id) as HTMLElement;
    if (!this.element) {
      throw new Error(`Loading indicator element with id '${id}' not found.`);
    }
    this.progressContainer = this.element.querySelector(
      ".progress-container",
    ) as HTMLElement;
    this.progressBar = this.element.querySelector(
      ".progress-bar",
    ) as HTMLElement;
    this.messageElement = this.element.querySelector(
      ".loading-message",
    ) as HTMLElement;
  }

  show(message: string, showProgress: boolean = false): void {
    this.element.classList.remove("hidden");
    this.updateMessage(message);
    this.toggleProgressBar(showProgress);
  }

  hide(): void {
    this.element.classList.add("hidden");
  }

  updateMessage(message: string): void {
    if (this.messageElement) {
      this.messageElement.textContent = message;
    }
  }

  updateProgress(current: number, total: number): void {
    if (this.progressBar) {
      const percentage = (current / total) * 100;
      this.progressBar.style.width = `${percentage}%`;
      this.updateMessage(
        `Processing ${current} of ${total} items (${Math.round(percentage)}%)`,
      );
    }
  }

  private toggleProgressBar(show: boolean): void {
    if (this.progressContainer) {
      this.progressContainer.classList.toggle("hidden", !show);
    }
  }
}
