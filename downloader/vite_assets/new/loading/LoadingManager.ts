// LoadingManager.ts
import { LoadingIndicator } from "./LoadingIndicator";

type LoadingMessage = {
  type: "start" | "update" | "end";
  message?: string;
  progress?: number;
  total?: number;
};

class LoadingManager {
  private static instance: LoadingManager;
  private indicator: LoadingIndicator;
  private isLoading: boolean = false;
  private queue: LoadingMessage[] = [];

  private constructor() {
    this.indicator = new LoadingIndicator();
  }

  public static getInstance(): LoadingManager {
    if (!LoadingManager.instance) {
      LoadingManager.instance = new LoadingManager();
    }
    return LoadingManager.instance;
  }

  public sendMessage(message: LoadingMessage): void {
    this.queue.push(message);
    this.processQueue();
  }

  private processQueue(): void {
    while (this.queue.length > 0) {
      const message = this.queue.shift()!;
      this.handleMessage(message);
    }
  }

  private handleMessage(message: LoadingMessage): void {
    switch (message.type) {
      case "start":
        this.isLoading = true;
        this.indicator.show(message.message || "Loading...", !!message.total);
        break;
      case "update":
        if (message.progress !== undefined && message.total !== undefined) {
          this.indicator.updateProgress(message.progress, message.total);
        } else if (message.message) {
          this.indicator.updateMessage(message.message);
        }
        break;
      case "end":
        this.isLoading = false;
        this.indicator.hide();
        break;
    }
  }
}

export const loadingManager = LoadingManager.getInstance();
